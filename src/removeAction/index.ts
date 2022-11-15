import { emptyBucket } from './bucket'
import cli from 'cli-foundation'
import aws from 'aws-foundation'

export async function removeAction(config: any) {
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

    await cli.filesystem.removeDir({
        path: '/' + config.zipConfig.hiddenFolder,
        projectRoot: process.cwd()
    })
    cli.terminal.clear()
    cli.terminal.printSuccessMessage('Removal Successfully Initialized')
}
