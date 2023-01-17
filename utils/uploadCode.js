import * as filesystem from 'rise-filesystem-foundation'
import * as aws from 'rise-aws-foundation'
import process from 'node:process'

/**
 * @param {string} bucketName
 * @param {object} config
 * @param {string} config.functionsLocation
 * @param {string} config.zipTarget
 * @param {string} config.hiddenFolder
 */
export async function uploadLambdas(bucketName, config) {
    const getAllPaths = () => {
        const lambaPaths = config.functionsLocation
        const lambdas = filesystem.getDirectories({
            path: lambaPaths,
            projectRoot: process.cwd()
        })
        return lambdas.map((name) => `${config.zipTarget}/${name}.zip`)
    }

    let result = []
    const paths = getAllPaths()
    for (const path of paths) {
        const file = await filesystem.getFile({
            path,
            projectRoot: process.cwd()
        })
        const res = await aws.s3.uploadFile({
            file,
            bucket: bucketName,
            key: path.split(config.hiddenFolder + '/')[1]
        })
        result.push(res)
    }

    return result
}
