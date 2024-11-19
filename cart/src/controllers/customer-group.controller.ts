import { Request, Response } from 'express'
import { queryCustomerGroup, createCustomerGroup, deleteCustomerGroup } from '../services/commercetools.service'
import CommercetoolsAuthClient from '../adapters/ct-auth-client'

export const create = async (req: Request, res: Response) => {
    for (const groups of req.body) {
        for (const group of groups) {
            console.log(group)
            await createCustomerGroup(group)
        }
    }
    res.status(200).send()
    return
}

export const remove = async (req: Request, res: Response) => {
    for (const groups of req.body) {
        for (const group of groups) {
            const q = await queryCustomerGroup(group.key)
            const d = await deleteCustomerGroup(group.key, q[0].version)
            console.log(d)
        }
    }
    res.status(200).send()
    return
}

export const test = async (req: Request, res: Response) => {
    console.log('abbb');
    // return res.status(200).send({data: '123'})
    return res.status(400).send({ data: '123' })
}