import cli from 'cli-foundation'
import aws from 'aws-foundation'
import { ZipConfig } from '../../types'

export async function uploadLambdas(bucketName: string, config: ZipConfig) {
    const getAllPaths = () => {
        const lambaPaths = config.functionsLocation
        const lambdas = cli.filesystem.getDirectories({
            path: lambaPaths,
            projectRoot: process.cwd()
        })
        return lambdas.map((name) => `${config.zipTarget}/${name}.zip`)
    }

    let result = []
    const paths = getAllPaths()
    for (const path of paths) {
        const file = await cli.filesystem.getFile({
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
