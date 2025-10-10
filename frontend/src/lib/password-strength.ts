/**
     * @param password: the password to test
     * 
     * @returns True if the password is strong enough. False otherwise.
     * 
     * A password is strong iff:
     *   1) is at least 16 characters long
     *   2) contains uppercase, lowercase, number and special characters
     *   3) has sufficient entropy --> IMPORTANT
     *   4) 1-3 would imply the password can not be found in a dictionary or weak password list
     *   5) additionally, substrings found in the dictionary should not contribute to password strength
     */
 function isStrongPassword(password:string):boolean{
    const one:boolean = password.length>15;
    //TODO: 2-5
    const two:boolean=false,three:boolean=false,four:boolean=false,five:boolean = false;

    return one&&two&&three&&four&&five;
}
export function setVerifiedPassword(setter:(input:React.SetStateAction<string>)=>void,password:string){
    if (!isStrongPassword(password))
        throw Error("weak password");
    
    setter(password);
}