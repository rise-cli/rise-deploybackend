import cli from 'cli-foundation'
import aws from 'aws-foundation'
import { deployInfra } from 'deployinfra'
import { FunctionConfig, ZipConfig } from '../../types'

type Input = {
    region: string
    appName: string
    bucketArn: string
    stage: string
    dashboard: boolean
    config: Record<string, FunctionConfig>
    zipConfig: ZipConfig
    additionalResources?: any
}

export async function deployApplication({
    region,
    appName,
    bucketArn,
    dashboard,
    stage,
    config,
    zipConfig,
    additionalResources
}: Input) {
    /**
     * Helpers
     */
    const getZipPaths = () => {
        const lambaPaths = zipConfig.functionsLocation
        const lambdas = cli.filesystem.getDirectories({
            path: lambaPaths,
            projectRoot: process.cwd()
        })
        const path = zipConfig.zipTarget.split(zipConfig.hiddenFolder + '/')[1]
        return [
            ...lambdas.map((x) => ({
                path: `${path}/${x}.zip`,
                name: x
            }))
        ]
    }

    /**
     * Initialize State
     */
    let template = {
        Resources: {},
        Outputs: {}
    }

    /**
     * Dashboard
     *
     */
    if (dashboard) {
        const cfDashboard = aws.cloudwatch.makeDashboard({
            name: `${appName}${stage}`,
            // @ts-ignore
            rows: Object.keys(config).map((l, i) => {
                const dConfig =
                    config[l] && config[l].dashboard
                        ? config[l].dashboard
                        : false

                if (!dConfig) {
                    return {
                        type: 'LAMBDAROW',
                        verticalPosition: i,
                        name: l,
                        region: region,
                        functionName: `${appName}-${l}-${stage}`,
                        docs: `# ${l}`
                    }
                }

                let row = {
                    type: 'LAMBDAROW',
                    verticalPosition: i,
                    name: l,
                    region: region,
                    functionName: `${appName}-${l}-${stage}`,
                    docs: dConfig.doc || `# ${l}`
                }

                if (dConfig.invocationAlarm) {
                    // @ts-ignore
                    row.invocationAlarm = dConfig.invocationAlarm
                }
                if (dConfig.invocationGoal) {
                    // @ts-ignore
                    row.invocationGoal = dConfig.invocationGoal
                }
                if (dConfig.errorAlarm) {
                    // @ts-ignore
                    row.errorAlarm = dConfig.errorAlarm
                }
                if (dConfig.errorGoal) {
                    // @ts-ignore
                    row.errorGoal = dConfig.errorGoal
                }
                if (dConfig.durationAlarm) {
                    // @ts-ignore
                    row.durationAlarm = dConfig.durationAlarm
                }
                if (dConfig.durationGoal) {
                    // @ts-ignore
                    row.durationGoal = dConfig.durationGoal
                }

                return row
            })
        })

        template.Resources = {
            ...template.Resources,
            ...cfDashboard.Resources
        }
    }

    /**
     * Alarms
     *
     */
    Object.keys(config).map((l, i) => {
        const functionConfig = config[l]
        const alarmConfig = functionConfig.alarm

        if (alarmConfig !== 'None') {
            const cf = aws.cloudwatch.makeLambdaErrorAlarm({
                appName,
                stage,
                name: l + 'Alarm',
                description: alarmConfig.description || '',
                functionName: `${appName}-${l}-${stage}`,
                threshold: alarmConfig.threshold,
                period: alarmConfig.period || 300,
                evaluationPeriods: alarmConfig.evaluationPeriods || 3,
                snsTopic: alarmConfig.snsTopic || undefined
            })

            template.Resources = {
                ...template.Resources,
                ...cf.Resources
            }
        }
    })

    /**
     * Make Lamnda CF
     *
     */
    let addAuth = false
    let urlConfigs: any[] = []
    const zipPaths = getZipPaths()
    zipPaths.forEach((x) => {
        const permissions = config[x.name]
            ? config[x.name].permissions.map((x) => ({
                  ...x,
                  Effect: 'Allow'
              }))
            : []

        const res = aws.lambda.makeLambda({
            appName: appName,
            name: x.name,
            stage: stage,
            bucketArn: bucketArn,
            bucketKey: x.path,
            env: config[x.name] ? config[x.name].env : {},
            handler: 'index.handler',
            permissions: permissions,
            timeout:
                config[x.name] && config[x.name].timeout
                    ? config[x.name].timeout
                    : 6,
            layers: config[x.name] ? config[x.name].layers : []
        })

        template.Resources = {
            ...template.Resources,
            ...res.Resources
        }
        template.Outputs = {
            ...template.Outputs,
            ...{
                [`Lambda${x.name}${stage}Arn`]: {
                    Value: {
                        'Fn::GetAtt': [`Lambda${x.name}${stage}`, 'Arn']
                    }
                }
            }
        }

        const t = config[x.name].eventRule
        if (t !== 'None') {
            const cf = aws.eventBridge.makeEventRule({
                appName: appName + stage,
                eventBus: t.bus || 'default',
                eventSource: t.source,
                eventName: t.name,
                lambdaName: `Lambda${x.name}${stage}`
            })
            template.Resources = {
                ...template.Resources,
                ...cf.Resources
            }
        }

        const url = config[x.name].url
        if (url !== 'None') {
            if (url.auth) {
                addAuth = true
            }
            urlConfigs.push({
                method: url.method,
                path: url.path,
                auth: url.auth,
                name: `Lambda${x.name}${stage}`
            })
        }
    })

    if (urlConfigs.length > 0) {
        const httpApiConfig = {
            name: appName,
            stage
        }

        if (addAuth) {
            // @ts-ignore
            httpApiConfig.auth = {
                poolIdRef: 'CognitoUserPool',
                clientIdRef: 'CognitoUserPoolClient'
            }
        }
        const httpApi = aws.apigateway.makeHttpApi(httpApiConfig)
        const httpRoutes = urlConfigs.reduce(
            (acc, k) => {
                const httpApiRouteConfig = {
                    route: k.path,
                    method: k.method,
                    functionReference: k.name
                }

                if (k.auth) {
                    // @ts-ignore
                    httpApiRouteConfig.authorizerRef = 'ApiAuthorizer'
                }
                const x = aws.apigateway.makeHttpApiRoute(httpApiRouteConfig)
                acc.Resources = {
                    ...acc.Resources,
                    ...x.Resources
                }

                return acc
            },
            {
                Resources: {},
                Outputs: {}
            }
        )

        template.Resources = {
            ...template.Resources,
            ...httpApi.Resources,
            ...httpRoutes.Resources
            // ...apiGateway.Resources,
            // ...apiGatewayRoutes.Resources
        }
        template.Outputs = {
            ...template.Outputs,
            ...httpApi.Outputs,
            ...httpRoutes.Outputs
            // ...apiGateway.Outputs,
            // ...apiGatewayRoutes.Outputs
        }
    }

    if (addAuth) {
        const cog = aws.cognito.makeCognito(appName, stage)
        template.Resources = {
            ...template.Resources,
            ...cog.Resources
        }

        template.Outputs = {
            ...template.Outputs,
            ...cog.Outputs
        }
    }

    template.Resources = {
        ...template.Resources,
        ...additionalResources.Resources
    }

    template.Outputs = {
        ...template.Outputs,
        ...additionalResources.Outputs
    }

    /**
     * Result
     */

    let outputs: string[] = []

    if (urlConfigs.length > 0) {
        outputs.push('ApiUrl')
    }

    if (addAuth) {
        outputs.push('UserPoolClientId')
        outputs.push('UserPoolId')
    }

    const result = await deployInfra({
        name: appName,
        stage,
        region,
        template: JSON.stringify(template),
        outputs
    })

    if (result.status === 'error') {
        throw new Error(result.message)
    }

    const theResult: Record<string, any> = {}

    if (urlConfigs.length > 0) {
        theResult.endpoints = urlConfigs.map((x) => {
            const n = x.name.slice(6).slice(0, -Math.abs(stage.length))
            return `${n}: ${result.outputs['ApiUrl']}/${x.path}`
        })
    }

    if (addAuth) {
        theResult.userPoolClient = result.outputs['UserPoolClientId']
        theResult.userPool = result.outputs['UserPoolId']
    }

    return theResult
}
