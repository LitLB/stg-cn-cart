export const validateOperator = (operatorNumber: string) => {

    const operatorTrue = ['05', '08'];
    const operatorDtac = ['02', '06'];

    const userOperator = operatorNumber.substring(3, 5)

    const isTrue = operatorTrue.includes(userOperator)
    const isDtac = operatorDtac.includes(userOperator)

    if (!isTrue && !isDtac) {
        throw {
            statusCode: "400",
            statusMessage: 'Operator not TRUE or DTAC',
            errorCode: 'OPERATOR_NOT_TRUE_OR_DTAC'
        }
    }


    return operatorNumber
}