import { Request, Response } from 'express'
import { queryCustomerGroup, createCustomerGroup, deleteCustomerGroup } from '../services/commercetools.service'

export const create = async (req: Request, res: Response) => {
        for (const group of req.body) {
            console.log(group)
            await createCustomerGroup(group)
        }
        res.status(200).send()
        return
}

export const remove = async (req: Request, res: Response) => {
        for (const group of req.body) {
            const q = await queryCustomerGroup(group.key)
            const d = await deleteCustomerGroup(group.key, q[0].version)
            console.log(d)
        }
        res.status(200).send()
        return
}
