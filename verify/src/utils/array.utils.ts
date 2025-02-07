interface ICharacteristics { 
    name: string;
    value: string;
}

export function getOTPReferenceCodeFromArray(characteristics: ICharacteristics[]): string | null {
    const otpCharacteristic = characteristics.find(item => item.name === "OTPReferenceCode");

    return otpCharacteristic ? otpCharacteristic.value : null;
}