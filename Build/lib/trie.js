/**
 * Suffix Trie based on Mnemonist Trie
 */

const SENTINEL = String.fromCodePoint(0);

/**
 * @param {string[] | Set<string>} [from]
 */
const createTrie = (from) => {
  let size = 0;
  const root = {};

  /**
   * Method used to add the given prefix to the trie.
   *
   * @param  {string} suffix - Prefix to follow.
   */
  const add = (suffix) => {
    let node = root;
    let token;
    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      node[token] ||= {};
      node = node[token];
    }

    // Do we need to increase size?
    if (!(SENTINEL in node)) {
      size++;
    }
    node[SENTINEL] = true;
  };

  /**
   * @param {string} suffix
   */
  const contains = (suffix) => {
    let node = root;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      node = node[token];

      if (node == null) return false;
    }

    return true;
  };
  /**
   * Method used to retrieve every item in the trie with the given prefix.
   *
   * @param  {string} suffix - Prefix to query.
   * @param  {boolean} [includeEqualWithSuffix]
   * @return {string[]}
   */
  const find = (suffix, includeEqualWithSuffix = true) => {
    let node = root;
    const matches = [];
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      node = node[token];

      if (node == null) return matches;
    }

    // Performing DFS from prefix
    const nodeStack = [node];

    const suffixStack = [suffix];
    let k;

    let $suffix = suffix;

    while (nodeStack.length) {
      $suffix = suffixStack.pop();
      node = nodeStack.pop();

      // eslint-disable-next-line guard-for-in -- plain object
      for (k in node) {
        if (k === SENTINEL) {
          if (includeEqualWithSuffix) {
            matches.push($suffix);
          } else if ($suffix !== suffix) {
            matches.push($suffix);
          }

          continue;
        }

        nodeStack.push(node[k]);
        suffixStack.push(k + $suffix);
      }
    }

    return matches;
  };

  /**
   * Method used to delete a prefix from the trie.
   *
   * @param  {string} suffix - Prefix to delete.
   * @return {boolean}
   */
  const remove = (suffix) => {
    let node = root;
    let toPrune = null;
    let tokenToPrune = null;
    let parent;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      parent = node;
      node = node[token];

      // Prefix does not exist
      if (typeof node === 'undefined') {
        return false;
      }

      // Keeping track of a potential branch to prune
      if (toPrune !== null) {
        if (Object.keys(node).length > 1) {
          toPrune = null;
          tokenToPrune = null;
        }
      } else if (Object.keys(node).length < 2) {
        toPrune = parent;
        tokenToPrune = token;
      }
    }

    if (!(SENTINEL in node)) return false;

    size--;

    if (toPrune) {
      delete toPrune[tokenToPrune];
    } else {
      delete node[SENTINEL];
    }

    return true;
  };

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   *
   * @param  {string} suffix - Prefix to check.
   * @return {boolean}
   */
  const has = (suffix) => {
    let node = root;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      node = node[token];

      if (typeof node === 'undefined') {
        return false;
      }
    }

    return SENTINEL in node;
  };

  if (from) {
    from.forEach(add);
  }

  return {
    add,
    contains,
    find,
    remove,
    delete: remove,
    has,
    get size() {
      return size;
    }
  };
};

// class Trie {
//   size = 0;
//   root = {};

//   /**
//    * @param {string} suffix
//    */
//   contains(suffix) {
//     let node = this.root;
//     let token;

//     for (let i = suffix.length - 1; i >= 0; i--) {
//       token = suffix[i];

//       node = node[token];

//       if (node == null) return false;
//     }

//     return true;
//   }

//   /**
//    * Method used to retrieve every item in the trie with the given prefix.
//    *
//    * @param  {string} suffix - Prefix to query.
//    * @param  {boolean} [includeEqualWithSuffix]
//    * @return {string[]}
//    */
//   find(suffix, includeEqualWithSuffix = true) {
//     let node = this.root;
//     const matches = [];
//     let token;

//     for (let i = suffix.length - 1; i >= 0; i--) {
//       token = suffix[i];

//       node = node[token];

//       if (node == null) return matches;
//     }

//     // Performing DFS from prefix
//     const nodeStack = [node];

//     const suffixStack = [suffix];
//     let k;

//     let $suffix = suffix;

//     while (nodeStack.length) {
//       $suffix = suffixStack.pop();
//       node = nodeStack.pop();

//       // eslint-disable-next-line guard-for-in -- plain object
//       for (k in node) {
//         if (k === SENTINEL) {
//           if (includeEqualWithSuffix) {
//             matches.push($suffix);
//           } else if ($suffix !== suffix) {
//             matches.push($suffix);
//           }

//           continue;
//         }

//         nodeStack.push(node[k]);
//         suffixStack.push(k + $suffix);
//       }
//     }

//     return matches;
//   }

//   // toJSON() {
//   //   return this.root;
//   // }

//   /**
//    * Method used to clear the trie.
//    *
//    * @return {void}
//    */
//   // clear() {
//   //   // Properties
//   //   this.root = {};
//   //   this.size = 0;
//   // }

//   /**
//    * Method used to update the value of the given prefix in the trie.
//    *
//    * @param  {string|array} prefix - Prefix to follow.
//    * @param  {(oldValue: any | undefined) => any} updateFunction - Update value visitor callback.
//    * @return {Trie}
//    */
//   // update(prefix, updateFunction) {
//   //   let node = this.root;
//   //   let token;

//   //   for (let i = 0, l = prefix.length; i < l; i++) {
//   //     token = prefix[i];

//   //     node = node[token] || (node[token] = {});
//   //   }

//   //   // Do we need to increase size?
//   //   if (!(SENTINEL in node))
//   //     this.size++;

//   //   node[SENTINEL] = updateFunction(node[SENTINEL]);

//   //   return this;
//   // }

//   /**
//    * Method used to delete a prefix from the trie.
//    *
//    * @param  {string} suffix - Prefix to delete.
//    * @return {boolean}
//    */
//   delete(suffix) {
//     let node = this.root;
//     let toPrune = null;
//     let tokenToPrune = null;
//     let parent;
//     let token;

//     for (let i = suffix.length - 1; i >= 0; i--) {
//       token = suffix[i];
//       parent = node;
//       node = node[token];

//       // Prefix does not exist
//       if (typeof node === 'undefined') {
//         return false;
//       }

//       // Keeping track of a potential branch to prune
//       if (toPrune !== null) {
//         if (Object.keys(node).length > 1) {
//           toPrune = null;
//           tokenToPrune = null;
//         }
//       } else if (Object.keys(node).length < 2) {
//         toPrune = parent;
//         tokenToPrune = token;
//       }
//     }

//     if (!(SENTINEL in node)) return false;

//     this.size--;

//     if (toPrune) {
//       delete toPrune[tokenToPrune];
//     } else {
//       delete node[SENTINEL];
//     }

//     return true;
//   }

//   /**
//    * Method used to assert whether the given prefix exists in the Trie.
//    *
//    * @param  {string} suffix - Prefix to check.
//    * @return {boolean}
//    */
//   has(suffix) {
//     let node = this.root;
//     let token;

//     for (let i = suffix.length - 1; i >= 0; i--) {
//       token = suffix[i];
//       node = node[token];

//       if (typeof node === 'undefined') {
//         return false;
//       }
//     }

//     return SENTINEL in node;
//   }

//   /**
//    * @return {string[]}
//    */
//   // dump() {
//   //   const node = this.root;
//   //   const nodeStack = [];
//   //   const prefixStack = [];
//   //   // Resolving initial prefix
//   //   const prefix = '';

//   //   nodeStack.push(node);
//   //   prefixStack.push(prefix);

//   //   /** @type {string[]} */
//   //   const results = [];

//   //   let currentNode;
//   //   let currentPrefix;
//   //   let hasValue = false;
//   //   let k;

//   //   while (nodeStack.length) {
//   //     currentNode = nodeStack.pop();
//   //     currentPrefix = prefixStack.pop();

//   //     // eslint-disable-next-line guard-for-in -- plain object
//   //     for (k in currentNode) {
//   //       if (k === SENTINEL) {
//   //         hasValue = true;
//   //         continue;
//   //       }

//   //       nodeStack.push(currentNode[k]);
//   //       prefixStack.push(k + currentPrefix);
//   //     }

//   //     if (hasValue) results.push(currentPrefix);
//   //   }

//   //   return results;
//   // }

//   /**
//    * Convenience known methods.
//    */
//   // inspect() {
//   //   const proxy = new Set();

//   //   const iterator = this.prefixes();
//   //   let step;

//   //   while ((step = iterator.next(), !step.done))
//   //     proxy.add(step.value);

//   //   // Trick so that node displays the name of the constructor
//   //   Object.defineProperty(proxy, 'constructor', {
//   //     value: Trie,
//   //     enumerable: false
//   //   });

//   //   return proxy;
//   // }
//   /**
//    * Static .from function taking an arbitrary iterable & converting it into
//    * a trie.
//    *
//    * @param  {string[] | Set<string>} iterable   - Target iterable.
//    * @return {Trie}
//    */
//   static from = iterable => {
//     const trie = new Trie();
//     iterable.forEach(i => trie.add(i));
//     return trie;
//   };
// }

/**
 * Exporting.
 */
module.exports.SENTINEL = SENTINEL;
module.exports = createTrie;
