import * as filesystem from 'rise-filesystem-foundation'
import * as aws from 'rise-aws-foundation'
import { deployInfra } from 'rise-deployinfra'
import process from 'node:process'

/**
 * @param {string} appName
 * @param {string} stage
 * @param {string} region
 */
export async function deployApplicationBucket(appName, stage, region) {
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

    filesystem.writeFile({
        path: '/.rise/data.js',
        content: `export const config = { bucketName: "${result.outputs.MainBucket}"}`,
        projectRoot: process.cwd()
    })

    return result.outputs.MainBucket
}
