import cli from 'cli-foundation'
import { zipLambdas } from './zipFiles'
import { deployApplicationBucket } from './deployApplicationBucket'
import { deployApplication } from './deployApplication'
import { uploadLambdas } from './uploadCode'
import { updateLambdaCode } from './updateCode'
import { ProjectConfig } from '../types'

export async function deployAction(config: ProjectConfig) {
    console.time('\x1b[2mDeploy Time')
    cli.terminal.clear()
    cli.terminal.hideCursor()

    /**
     * Zip Code
     */
    cli.terminal.startLoadingMessage('Zipping up code')
    await zipLambdas(config.zipConfig)
    cli.terminal.endLoadingMessage()
    const deployName = config.deployName

    /**
     * Deploy Bucket
     */
    if (!config.app.bucketName) {
        const bucketName: string = await deployApplicationBucket(
            deployName,
            config.app.stage,
            config.app.region
        )

        config.app.bucketName = bucketName
    }

    cli.terminal.startLoadingMessage('Uploading code to AWS S3')
    await uploadLambdas(config.app.bucketName, config.zipConfig)
    cli.terminal.endLoadingMessage()

    if (config.deployInfra) {
        /**
         * Deploy Application
         */

        const deployResult = await deployApplication({
            region: config.app.region,
            appName: config.app.appName,
            bucketArn: 'arn:aws:s3:::' + config.app.bucketName,
            stage: config.app.stage,
            config: config.functions,
            dashboard: config.app.dashboard,
            zipConfig: config.zipConfig,
            additionalResources: config.additionalResources
        })

        /**
         * Update Code
         */
        await updateLambdaCode({
            appName: config.app.appName,
            bucket: config.app.bucketName,
            stage: config.app.stage,
            zipConfig: config.zipConfig,
            region: config.app.region
        })
        cli.terminal.endLoadingMessage()

        /**
         * Display Result
         */
        if (deployResult.endpoints) {
            console.log('')
            cli.terminal.printInfoMessage('Endpoints')
            deployResult.endpoints.forEach((x: string) => {
                cli.terminal.print(cli.terminal.makeDimText(x))
            })
        }

        if (deployResult.userPoolClient) {
            console.log('')
            cli.terminal.printInfoMessage('User Pool Details')

            cli.terminal.print(
                cli.terminal.makeDimText('PoolId:   ' + deployResult.userPool)
            )
            cli.terminal.print(
                cli.terminal.makeDimText(
                    'ClientId: ' + deployResult.userPoolClient
                )
            )
        }

        console.log('')
        console.timeEnd('\x1b[2mDeploy Time')
    } else {
        /**
         * Update Code
         */
        await updateLambdaCode({
            appName: config.app.appName,
            bucket: config.app.bucketName,
            stage: config.app.stage,
            zipConfig: config.zipConfig,
            region: config.app.region
        })
        cli.terminal.endLoadingMessage()
        console.log('')
        console.timeEnd('\x1b[2mDeploy Time')
    }
}
