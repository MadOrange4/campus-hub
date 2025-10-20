//import {readFileSync} from 'fs';
function passwordEntropy(password) {
    var alphabetSize = 95;
    var passSize = password.length;
    var charArr = Array.from(password);
    //Ideally, a password is a random string, which characters from the character space distributed uniformly into the password.
    //We have: 26 + 26 + 10 + 33 total characters, for alpha ALPHA digit and special characters.
    //so the probability we choose a character c at random is 1/(95).
    //then the probability that if we choose |password| characters from the alphabet, exactly C(char \in password) are char is
    //|password|*C(char\in password). I.E. we can expect exactly one occurrence of every character in the alphabet on average, if the password has length 95.
    //Of course, it is reasonable to have some duplicate characters.
    //for each character, we obtain its count, and determine how far that is from the expected value.
    //we take the cumulative sum of the absolute values of these differences.
    var E = passSize / alphabetSize;
    var charSet = new Map();
    charArr.forEach(function (element) {
        if (charSet.has(element)) {
            charSet.set(element, charSet.get(element) + 1);
        }
        else {
            charSet.set(element, 1);
        }
    });
    var it = charSet.values();
    var e = 0;
    var val = 0;
    while ((e = it.next().value) != undefined) {
        val += Math.abs(E - Math.pow(alphabetSize, -e));
    }
    //prevent passwords from being punished for being longer...
    val = (passSize * (E - 1 / alphabetSize)) / val;
    //Additionally, we want to ensure a fair distribution among the different groups of characters. I.E. a user should not add
    //only one of each: uppercase, number and special character in the password to satisfy requirements.
    var groups = [0, 0, 0, 0];
    charArr.forEach(function (v) {
        if (v.match(/[A-Z]/) != null) {
            groups[0]++;
        }
        else if (v.match(/[a-z]/) != null) {
            groups[1]++;
        }
        else if (v.match(/[0-9]/) != null) {
            groups[2]++;
        }
        else {
            groups[3]++;
        }
    });
    //special characters are 33/95
    //uppercase and lowercase are 26/95 each
    //digits are 10/95
    var k1 = groups[0] / 26;
    var k2 = groups[1] / 26;
    var k3 = groups[2] / 10;
    var k4 = groups[3] / 33;
    var m = (k1 + k2 + k3 + k4) / 4;
    var v = 0;
    [k1, k2, k3, k4].forEach(function (value) {
        v += Math.pow((value - m), 2);
    });
    v = v / 3;
    //therefore we expect the array groups to look something like [26k, 26k, 10k, 33k] for some k. 
    //magic numbers, hope theyre good...
    return v < 0.035 && val < 1 + (0.13 * passSize) / 16;
}
function passwordEntropy2(password) {
    var alphabetSize = 95;
    var passSize = password.length;
    var charArr = Array.from(password);
    //Ideally, a password is a random string, which characters from the character space distributed uniformly into the password.
    //We have: 26 + 26 + 10 + 33 total characters, for alpha ALPHA digit and special characters.
    //so the probability we choose a character c at random is 1/(95).
    //then the probability that if we choose |password| characters from the alphabet, exactly C(char \in password) are char is
    //|password|*C(char\in password). I.E. we can expect exactly one occurrence of every character in the alphabet on average, if the password has length 95.
    //Of course, it is reasonable to have some duplicate characters.
    //for each character, we obtain its count, and determine how far that is from the expected value.
    //we take the cumulative sum of the absolute values of these differences.
    var E = passSize / alphabetSize;
    var charSet = new Map();
    charArr.forEach(function (element) {
        if (charSet.has(element)) {
            charSet.set(element, charSet.get(element) + 1);
        }
        else {
            charSet.set(element, 1);
        }
    });
    var it = charSet.values();
    var e = 0;
    var val = 0;
    while ((e = it.next().value) != undefined) {
        val += Math.abs(E - Math.pow(alphabetSize, -e));
    }
    //prevent passwords from being punished for being longer...
    val = (passSize * (E - 1 / alphabetSize)) / val;
    //Additionally, we want to ensure a fair distribution among the different groups of characters. I.E. a user should not add
    //only one of each: uppercase, number and special character in the password to satisfy requirements.
    var closure = function () {
        var last = -1;
        var permShapeCount = 1;
        var obj = {
            update: function (v) {
                var i = -1;
                if (v.match(/[A-Z]/) != null) {
                    i = 0;
                }
                else if (v.match(/[a-z]/) != null) {
                    i = 1;
                }
                else if (v.match(/[0-9]/) != null) {
                    i = 2;
                }
                else {
                    i = 3;
                }
                permShapeCount = last == i ? permShapeCount : permShapeCount + 1;
                last = i;
                return i;
            },
            get: function () {
                return permShapeCount;
            },
        };
        return Object.freeze(obj);
    };
    var groups = [0, 0, 0, 0];
    var obj = closure();
    charArr.forEach(function (v) {
        groups[obj.update(v)]++;
    });
    //special characters are 33/95
    //uppercase and lowercase are 26/95 each
    //digits are 10/95
    var k1 = groups[0] / 26;
    var k2 = groups[1] / 26;
    var k3 = groups[2] / 10;
    var k4 = groups[3] / 33;
    var m = (k1 + k2 + k3 + k4) / 4;
    var v = 0;
    [k1, k2, k3, k4].forEach(function (value) {
        v += Math.pow((value - m), 2);
    });
    v = v / 3;
    //therefore we expect the array groups to look something like [26k, 26k, 10k, 33k] for some k.
    return [v, val, obj.get()];
    //const fact = (i:number):number => {let c = 1; let prod = 1;while (c<i){prod *= ++c}return prod}
} /*
function lcss(s1:string, s2:string):number{
  const DP:number[][] = new Array<number[]>(s1.length);
  let ans =0;
  for (let i = 0; i< DP.length;i++){
    DP[i] = new Array<number>(s2.length);
    DP[i][0]= (s1.charAt(0)===s2.charAt(i))?1:0;
  }
  
  for(let i = 1; i < s2.length;i++){
    DP[0][i] = (s1.charAt(1)===s2.charAt(0))?1:0
  }
  for (let i = 1; i < s1.length;i++){
    for (let j = 1; j < s2.length;j++){
      if (s1.charAt(i)===s2.charAt(j)){
        ans = Math.max(ans,DP[i][j] = 1 + DP[i-1][j-1]);
      } else {
        DP[i][j] = 0;
      }

    }
  }
  return ans;
}
*/
function test_simpleCasePasswordEntropy() {
    var pw = "password!b123456";
    var entropy = passwordEntropy(pw);
    console.log("1" + entropy);
    var entropy2 = passwordEntropy2(pw);
    console.log("2" + entropy2);
    pw = "0lQdp&iJ>D;l<?&%";
    entropy = passwordEntropy(pw);
    console.log("3" + entropy);
    entropy2 = passwordEntropy2(pw);
    console.log("4" + entropy2);
} /*
function test_lcss(){
  const s1 = "password";
  const s2 = "bassd";
  console.log("overlap: "+lcss(s1,s2));
}
function test_lcss2(){
  const pw = "wkASog;T9AWO0;I)";
  const file = readFileSync("../lib/bannedPasswords.txt","utf-8");
  console.log("file length: "+file.length);
  const arr = file.split("\n");
  console.log("is matching: "+arr.some((e:string):boolean=>{return lcss(pw,e)>3}))
}*/
test_simpleCasePasswordEntropy();
//test_lcss();
//test_lcss2();
