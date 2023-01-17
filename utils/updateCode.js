import * as filesystem from 'rise-filesystem-foundation'
import * as aws from 'rise-aws-foundation'
import process from 'node:process'

/**
 * @param {string} appName
 * @param {string} stage
 * @param {string} region
 * @param {string} bucket
 * @param {object} config
 * @param {string} config.functionsLocation
 * @param {string} config.zipTarget
 * @param {string} config.hiddenFolder
 */
export async function updateLambdaCode({
    appName,
    stage,
    region,
    bucket,
    zipConfig
}) {
    const getAllPaths = () => {
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

    const getFunctionName = (name) => `${appName}-${name}-${stage}`
    for (const l of getAllPaths()) {
        const lambdaName = getFunctionName(l.name)

        await aws.lambda.updateLambdaCode({
            name: lambdaName,
            filePath: l.path,
            bucket: bucket,
            region
        })
    }
}
