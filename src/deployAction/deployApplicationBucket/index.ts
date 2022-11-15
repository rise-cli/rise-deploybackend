import cli from 'cli-foundation'
import aws from 'aws-foundation'
import { deployInfra } from 'deployinfra' //'../../../deployInfra'

export async function deployApplicationBucket(
    appName: string,
    stage: string,
    region: string
): Promise<string> {
    /**
     * Deploy Stack
     */
    const bucketTemplate = aws.s3.makeBucket('Main')
    const stackName = appName + stage + '-bucket'

    const result = await deployInfra({
        name: stackName,
        stage,
        region,
        template: JSON.stringify(bucketTemplate),
        outputs: ['MainBucket']
    })

    if (result.status === 'error') {
        throw new Error(result.message)
    }

    cli.filesystem.writeFile({
        path: '/.rise/data.js',
        content: `module.exports = { bucketName: "${result.outputs.MainBucket}"}`,
        projectRoot: process.cwd()
    })

    return result.outputs.MainBucket
}
