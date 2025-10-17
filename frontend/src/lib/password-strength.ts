import badPass from "./bannedPasswords.json";

function passwordEntropy(password: string): boolean {
  const alphabetSize = 95;
  const passSize = password.length;
  const charArr: string[] = Array.from(password);
  //Ideally, a password is a random string, which characters from the character space distributed uniformly into the password.
  //We have: 26 + 26 + 10 + 33 total characters, for alpha ALPHA digit and special characters.
  //so the probability we choose a character c at random is 1/(95).

  //then the probability that if we choose |password| characters from the alphabet, exactly C(char \in password) are char is
  //|password|*C(char\in password). I.E. we can expect exactly one occurrence of every character in the alphabet on average, if the password has length 95.
  //Of course, it is reasonable to have some duplicate characters.

  //for each character, we obtain its count, and determine how far that is from the expected value.
  //we take the cumulative sum of the absolute values of these differences.
  const E = passSize / alphabetSize;
  const charSet = new Map<string, number>();
  charArr.forEach((element) => {
    if (charSet.has(element)) {
      charSet.set(element, charSet.get(element)! + 1);
    } else {
      charSet.set(element, 1);
    }
  });
  const it: MapIterator<number> = charSet.values();
  let e: number | undefined = 0;
  let val = 0;
  while ((e = it.next().value) != undefined) {
    val += Math.abs(E - Math.pow(alphabetSize, -e));
  }
  //prevent passwords from being punished for being longer...
  val = (passSize * (E - 1 / alphabetSize)) / val;

  //Additionally, we want to ensure a fair distribution among the different groups of characters. I.E. a user should not add
  //only one of each: uppercase, number and special character in the password to satisfy requirements.

  const closure = (): { update: (v: string) => number; get: () => number } => {
    let last = -1;
    let permShapeCount = 1;
    const obj = {
      update: (v: string): number => {
        let i = -1;
        if (v.match(/[A-Z]/) != null) {
          i = 0;
        } else if (v.match(/[a-z]/) != null) {
          i = 1;
        } else if (v.match(/[0-9]/) != null) {
          i = 2;
        } else {
          i = 3;
        }
        permShapeCount = last === i ? permShapeCount : permShapeCount + 1;
        last = i;
        return i;
      },
      get: () => {
        return permShapeCount;
      },
    };
    return Object.freeze(obj);
  };

  const groups = [0, 0, 0, 0];
  const obj = closure();
  charArr.forEach((v) => {
    groups[obj.update(v)]++;
  });
  //special characters are 33/95
  //uppercase and lowercase are 26/95 each
  //digits are 10/95
  const k1 = groups[0] / 26;
  const k2 = groups[1] / 26;
  const k3 = groups[2] / 10;
  const k4 = groups[3] / 33;
  const m = (k1 + k2 + k3 + k4) / 4;
  let v = 0;
  [k1, k2, k3, k4].forEach((value) => {
    v += (value - m) ** 2;
  });
  v = v / 3;
  //therefore we expect the array groups to look something like [26k, 26k, 10k, 33k] for some k.

  //magic numbers, hope theyre good...
  return (
    v < 0.035 + passSize/1600 &&
    val < 1 + (passSize) / 64 &&
    obj.get() >= 3 + Math.sqrt(passSize)
  );
  //const fact = (i:number):number => {let c = 1; let prod = 1;while (c<i){prod *= ++c}return prod}
}
//returns the length of the longest common substring between s1 and s2
function lcss(s1: string, s2: string): number {
  const DP: number[][] = new Array<number[]>(s1.length);
  let ans = 0;
  for (let i = 0; i < DP.length; i++) {
    DP[i] = new Array<number>(s2.length);
    DP[i][0] = s1.charAt(0) === s2.charAt(i) ? 1 : 0;
  }

  for (let i = 1; i < s2.length; i++) {
    DP[0][i] = s1.charAt(1) === s2.charAt(0) ? 1 : 0;
  }
  for (let i = 1; i < s1.length; i++) {
    for (let j = 1; j < s2.length; j++) {
      if (s1.charAt(i) === s2.charAt(j)) {
        ans = Math.max(ans, (DP[i][j] = 1 + DP[i - 1][j - 1]));
      } else {
        DP[i][j] = 0;
      }
    }
  }
  return ans;
}
//an optional potentially faster (i think it will be not necessary on average tho) lcss which auto breaks after overlap of n long found:
//returns false if an overlap of length n is found, true otherwise
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function short_circuit_lcss(s1: string, s2: string, n: number): boolean {
  const DP: number[][] = new Array<number[]>(s1.length);
  let ans = 0;
  for (let i = 0; i < DP.length; i++) {
    DP[i] = new Array<number>(s2.length);
    DP[i][0] = s1.charAt(0) === s2.charAt(i) ? 1 : 0;
  }

  for (let i = 1; i < s2.length; i++) {
    DP[0][i] = s1.charAt(1) === s2.charAt(0) ? 1 : 0;
  }
  for (let i = 1; i < s1.length; i++) {
    for (let j = 1; j < s2.length; j++) {
      if (s1.charAt(i) === s2.charAt(j)) {
        ans = Math.max(ans, (DP[i][j] = 1 + DP[i - 1][j - 1]));
        if (ans >= n) return false;
      } else {
        DP[i][j] = 0;
      }
    }
  }
  return true;
}
function getBannedPasswords(): string[] {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  return badPass.arr;
}

/**
 * @param {string} password: the password string to test
 *
 * @returns
 *          an object that has the strength truth value, and an array of issues. {strong, issues}.
 *          strong is true iff the password is strong.
 *          issues contains issues that make the password weak, or empty strings otherwise.
 *
 * A password is strong iff:
 *   1) is at least 16 characters long
 *   2) contains uppercase, lowercase, number and special characters
 *   3) has sufficient entropy --> IMPORTANT
 *   4) additionally, substrings found in the dictionary should not contribute to password strength
 */
export function isStrongPassword(password: string): {
  strong: boolean;
  issues: string[];
} {
  const one: boolean = password.length > 15;
  const two: boolean =
    password.match(/[A-Z]/) != null &&
    password.match(/[a-z]/) != null &&
    password.match(/\W/) != null &&
    password.match(/\d/) != null;
  //uppercase, lowercase, special character, number respectively.
  const three: boolean = passwordEntropy(password);
  const badPasswords = getBannedPasswords();
  const four: boolean = !badPasswords.some((badPass): boolean => {
    return lcss(password, badPass) > 4;
  });
  const issues: string[] = Array(4);
  issues[0] = !one ? "Your password is too short.\n" : "";
  issues[1] = !two
    ? "Your password is constructed from an alphabet which lacks at least one of uppercase, lowercase, number or special characters (underscore is not a special character).\n"
    : "";
  issues[2] = !three ? "Your password has low entropy.\n" : "";
  issues[3] = !four
    ? "Your password is too similar to a common password, or you used keys too close to each other on the keyboard"
    : "";

  const strong: boolean = one && two && three && four;
  return { strong, issues };
}
