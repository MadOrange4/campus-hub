import BitVector
#pip install BitVector
#idk if we even want this, but at least now we have something to present
#no live demo (untested)
class string_compressor:
    """
    @param alphabet: a string with all characters in the alphabet, each character exactly once. Order determines
                     how the string will be split at each layer.
    """
    def __init__(self, alphabet):
        self._alphabet = string_compressor._make_alphabet(alphabet)
        self.__compressed = [] #arr should be interpreted as for example:
        #root, root.left, root.left.left, None(implies previous is leaf), root.left.right, None, root.right is BitVector size 0 (would imply root has 1 child).
    def compress(self,str):
        return self.compress(str,0)
    def _compress(self,str,depth,base_case=false):
        if (depth==8):
            return #I believe this will never happen (ascii alphabet, if larger then we should delete this...)
        if len(str)==0:
            self.__compressed.append(BitVector(size=0))#in this case, the preceeding element has 1 child
            return
        bv = BitVector(size = len(str))
        for i,char in enumerate(str):
            bv[i]=self._alphabet.get(ord(char))
        self.__compressed.append(bv)
        if base_case:
            #here, it may make sense to append null
            #to the compressed array, to make interpreting
            #the string (decompression) easier
            self.__compressed.append(None)#this means the preceeding element is a leaf
            return
        left = ""
        right = ""
        base_caseL = True
        base_caseR = True
        lastL = ""
        lastR = ""
        for index,bit in enumerate(bv):
            if bit ==0:
                left = left + str[index]
                base_caseL = True if lastL == "" else base_case and lastL==str[index]
                lastL = str[index]
            else:
                right = right + str[index]
                base_caseR = True if lastR == "" else base_case and lastR==str[index]
                lastR = str[index]
        if base_caseL:
            self._compress(left,depth+1,True)
            return
        self._compress(left,depth+1)
        if base_caseR:
            self._compress(right,depth+1,True)
            return
        self.compress(right,depth+1)
        return    
    #TODO interpret compressed array to reconstruct string
    def decompress(self, arr):
        pass
    
    """TODO
        add any useful string operations we want to do to the compressed string in place, e.g. longest common substring"""
    
    #TODO compress str according to alphabet and check against the compressed. May have false positives, so do a second check
    #I believe, but have not proven that in general string operations will take roughly a factor of log alphaSize more time asymptotically
    def compressed_lcss(self, str):
        pass
    """TODO
        the idea for these functions is to first construct an alphabet based only on the characters in the strings
        and for the strings to be split roughly in half at each depth
        the compress function would also need to return the compressed string's alphabet. 
        And balanced decompress would need to make use of it."""
    def balanced_compress(self,str):
        pass
    def balanced_decompress(self,str,balanced_alphabet):
        pass

    def _make_alphabet(alphabet):
        size = len(alphabet)
        dict = {}
        i = 1
        for char in alphabet:
            d[char] = string_compressor._left_right_partition(i,size)
            i+=1
    def _left_right_partition(num,alphaSize):
        ans = []
        while alphaSize >= 2:
            if (num <= alphaSize//2):
                ans.append(0)
                alphaSize=alphaSize//2
                #this means we should go left
            else:
                ans.append(1)
                alphaSize = alphaSize-alphaSize//2
                #this means we should go right
        return ans




