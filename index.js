import * as cli from 'rise-cli-foundation'
import * as filesystem from 'rise-filesystem-foundation'
import { zipLambdas } from './utils/zipFiles.js'
import { deployApplicationBucket } from './utils/deployApplicationBucket.js'
import { deployApplication } from './utils/deployApplicationStack.js'
import { uploadLambdas } from './utils/uploadCode.js'
import { updateLambdaCode } from './utils/updateCode.js'
import { emptyBucket } from './utils/emptyBucket.js'
import process from 'node:process'

export async function deployBackend(config) {
    cli.clear()
    console.time('✅ Deployed Successfully \x1b[2mDeploy Time')
    cli.hideCursor()

    /**
     * Zip Code
     */
    await zipLambdas(config.zipConfig)
    const deployName = config.deployName

    /**
     * Deploy Bucket
     */
    if (!config.app.bucketName) {
        const bucketName = await deployApplicationBucket(
            deployName,
            config.app.stage,
            config.app.region
        )

        config.app.bucketName = bucketName
    }

    /**
     * Upload code to S3
     */
    cli.clear()
    cli.startLoadingMessage('Uploading code to AWS S3')
    await uploadLambdas(config.app.bucketName, config.zipConfig)
    cli.endLoadingMessage()

    /**
     * Deploy Application
     */
    cli.clear()
    if (config.deployInfra) {
        cli.startLoadingMessage('Preparing CloudFormation Template')
        const deployResult = await deployApplication({
            region: config.app.region,
            appName: config.app.appName,
            bucketArn: 'arn:aws:s3:::' + config.app.bucketName,
            stage: config.app.stage,
            config: config.functions,
            zipConfig: config.zipConfig,
            additionalResources: config.additionalResources
        })

        /**
         * Update Code
         */
        cli.clear()
        cli.startLoadingMessage('Updating Lambda Functions')
        await updateLambdaCode({
            appName: config.app.appName,
            bucket: config.app.bucketName,
            stage: config.app.stage,
            zipConfig: config.zipConfig,
            region: config.app.region
        })
        cli.endLoadingMessage()

        /**
         * Display Result
         */
        cli.clear()
        console.timeEnd('✅ Deployed Successfully \x1b[2mDeploy Time')
        console.log('')

        if (deployResult.endpoints) {
            cli.printInfoMessage('Endpoints')
            deployResult.endpoints.forEach((x) => {
                cli.print(cli.makeDimText(x))
            })
        }

        if (deployResult.userPoolClient) {
            console.log('')
            cli.printInfoMessage('User Pool Details')
            cli.print(cli.makeDimText('PoolId:   ' + deployResult.userPool))
            cli.print(
                cli.makeDimText('ClientId: ' + deployResult.userPoolClient)
            )
        }

        cli.showCursor()
    } else {
        /**
         * Update Code
         */
        cli.clear()
        cli.startLoadingMessage('Updating Lambda Functions')
        await updateLambdaCode({
            appName: config.app.appName,
            bucket: config.app.bucketName,
            stage: config.app.stage,
            zipConfig: config.zipConfig,
            region: config.app.region
        })

        cli.endLoadingMessage()
        cli.clear()
        console.timeEnd('✅ Deployed Successfully \x1b[2mDeploy Time')
        cli.showCursor()
    }
}

export async function removeBackend(config) {
    /**
     * Get project  info locally
     */
    const stage = config.stage
    const region = config.region
    let projectData = {
        name: config.name,
        bucketName: config.bucketName
    }

    /**
     * Get Project info remotely if local isnt available
     */
    const deployName = config.deployName
    if (!projectData.bucketName) {
        const stackName = deployName + stage + '-bucket'
        const { MainBucket } = await aws.cloudformation.getOutputs({
            stack: stackName,
            outputs: ['MainBucket']
        })

        projectData.bucketName = MainBucket
    }

    const stackName = deployName + stage + '-bucket'

    /**
     * Empty bucket
     */
    await emptyBucket({
        bucketName: projectData.bucketName
    })

    /**
     * Remove stack
     */
    await aws.cloudformation.removeStack({
        name: stackName,
        region,
        template: ''
    })

    await filesystem.removeDir({
        path: '/' + config.zipConfig.hiddenFolder,
        projectRoot: process.cwd()
    })
    cli.clear()
    cli.printSuccessMessage('Removal Successfully Initialized')
}
