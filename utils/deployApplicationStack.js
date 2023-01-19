import * as filesystem from 'rise-filesystem-foundation'
import * as aws from 'rise-aws-foundation'
import { deployInfra } from 'rise-deployinfra'
import process from 'node:process'

/**
 * @param {object} props
 * @param {string} props.region
 * @param {string} props.appName
 * @param {string} props.bucketArn
 * @param {string} props.stage
 * @param {boolean} props.dashboard
 * @param {object} props.config
 * @param {object} props.zipConfig
 * @param {object} [props.additionalResources]
 */
export async function deployApplication({
    region,
    appName,
    bucketArn,
    stage,
    config,
    zipConfig,
    additionalResources
}) {
    /**
     * Helpers
     */
    const getZipPaths = () => {
        const lambaPaths = zipConfig.functionsLocation
        const lambdas = filesystem.getDirectories({
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
     * Alarms
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
     * Make Lamnda
     */
    let addAuth = false
    let urlConfigs = []
    const zipPaths = getZipPaths()
    zipPaths.forEach((x) => {
        const permissions = config[x.name]
            ? config[x.name].permissions.map((x) => ({
                  ...x,
                  Effect: 'Allow'
              }))
            : []

        let lambdaEnv = {}

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

        const res = aws.lambda.makeLambda({
            appName: appName,
            name: x.name,
            stage: stage,
            bucketArn: bucketArn,
            bucketKey: x.path,
            env: config[x.name]
                ? { ...config[x.name].env, ...lambdaEnv }
                : lambdaEnv,
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
    })

    if (urlConfigs.length > 0) {
        const httpApiConfig = {
            name: appName,
            stage
        }

        const httpApi = aws.apigateway.makeHttpApi(httpApiConfig)
        const httpRoutes = urlConfigs.reduce(
            (acc, k) => {
                const httpApiRouteConfig = {
                    route: k.path,
                    method: k.method,
                    functionReference: k.name
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
        }
        template.Outputs = {
            ...template.Outputs,
            ...httpApi.Outputs,
            ...httpRoutes.Outputs
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
    let outputs = []

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

    const theResult = {}
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
