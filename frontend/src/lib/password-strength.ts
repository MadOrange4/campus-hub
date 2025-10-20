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
  const n = s1.length, m = s2.length;
  if (n === 0 || m === 0) return 0;

  const DP: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0));
  let ans = 0;

  // init [0][0]
  DP[0][0] = s1[0] === s2[0] ? 1 : 0;
  ans = DP[0][0];

  // first column
  for (let i = 1; i < n; i++) {
    DP[i][0] = (s1[i] === s2[0]) ? 1 : 0;
    if (DP[i][0] > ans) ans = DP[i][0];
  }
  // first row
  for (let j = 1; j < m; j++) {
    DP[0][j] = (s1[0] === s2[j]) ? 1 : 0;
    if (DP[0][j] > ans) ans = DP[0][j];
  }

  // fill the rest
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      if (s1[i] === s2[j]) {
        DP[i][j] = DP[i - 1][j - 1] + 1;
        if (DP[i][j] > ans) ans = DP[i][j];
      } else {
        DP[i][j] = 0; // substring must be contiguous
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
  const issues: string[] = [];

  // 1) length
  const longEnough = password.length >= 8;  // was >15
  if (!longEnough) issues.push("Use at least 8 characters.");

  // 2) optional light diversity (3 of 4), not required
  const classes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[\W_]/.test(password),
  ].filter(Boolean).length;
  const diverseEnough = classes >= 3;
  if (!diverseEnough) issues.push("Include 3 of: upper, lower, number, symbol.");

  // 3) banned / breached similarity (relax threshold)
  const badPasswords = getBannedPasswords();
  const tooSimilar = badPasswords.some(bp => lcss(password, bp) >= 7); // was >4
  if (tooSimilar) issues.push("Too similar to a common password.");

  const strong = longEnough && !tooSimilar; // diversity just a nudge
  return { strong, issues };
}
