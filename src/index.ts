import { deployAction } from './deployAction'
import { removeAction } from './removeAction'

export const deployBackend = {
    deploy: deployAction,
    remove: removeAction
}
