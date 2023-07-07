/**
 * Suffix Trie based on Mnemonist Trie
 */

const SENTINEL = String.fromCharCode(0);

class Trie {
  size = 0;
  root = {};

  /**
   * Method used to add the given prefix to the trie.
   *
   * @param  {string} suffix - Prefix to follow.
   * @return {Trie}
   */
  add(suffix) {
    let node = this.root;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];

      node = node[token] || (node[token] = {});
    }

    // Do we need to increase size?
    if (!(SENTINEL in node)) this.size++;
    node[SENTINEL] = true;

    return this;
  }

  /**
   * Method used to retrieve every item in the trie with the given prefix.
   *
   * @param  {string} suffix - Prefix to query.
   * @param  {boolean} [includeEqualWithSuffix]
   * @return {string[]}
   */
  find(suffix, includeEqualWithSuffix = true) {
    let node = this.root;
    const matches = [];
    let token;
    let i;
    let l;

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
  }

  toJSON() {
    return this.root;
  }

  /**
   * Method used to clear the trie.
   *
   * @return {void}
   */
  // clear() {
  //   // Properties
  //   this.root = {};
  //   this.size = 0;
  // }

  /**
   * Method used to update the value of the given prefix in the trie.
   *
   * @param  {string|array} prefix - Prefix to follow.
   * @param  {(oldValue: any | undefined) => any} updateFunction - Update value visitor callback.
   * @return {Trie}
   */
  // update(prefix, updateFunction) {
  //   let node = this.root;
  //   let token;

  //   for (let i = 0, l = prefix.length; i < l; i++) {
  //     token = prefix[i];

  //     node = node[token] || (node[token] = {});
  //   }

  //   // Do we need to increase size?
  //   if (!(SENTINEL in node))
  //     this.size++;

  //   node[SENTINEL] = updateFunction(node[SENTINEL]);

  //   return this;
  // }

  /**
   * Method used to delete a prefix from the trie.
   *
   * @param  {string|array} suffix - Prefix to delete.
   * @return {boolean}
   */
  delete(suffix) {
    let node = this.root;
    let toPrune = null;
    let tokenToPrune = null;
    let parent;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      parent = node;
      node = node[token];

      // Prefix does not exist
      if (typeof node === 'undefined')
        return false;

      // Keeping track of a potential branch to prune
      if (toPrune !== null) {
        if (Object.keys(node).length > 1) {
          toPrune = null;
          tokenToPrune = null;
        }
      }
      else {
        if (Object.keys(node).length < 2) {
          toPrune = parent;
          tokenToPrune = token;
        }
      }
    }

    if (!(SENTINEL in node)) return false;

    this.size--;

    if (toPrune) {
      delete toPrune[tokenToPrune];
    } else {
      delete node[SENTINEL];
    }

    return true;
  }

  /**
   * Method used to assert whether the given prefix exists in the Trie.
   *
   * @param  {string} suffix - Prefix to check.
   * @return {boolean}
   */
  has(suffix) {
    let node = this.root;
    let token;

    for (let i = suffix.length - 1; i >= 0; i--) {
      token = suffix[i];
      node = node[token];

      if (typeof node === 'undefined')
        return false;
    }

    return SENTINEL in node;
  }

  /**
   * Method returning an iterator over the trie's prefixes.
   *
   * @param  {string|array} [prefix] - Optional starting prefix.
   * @return {Iterator}
   */
  // prefixes(prefix) {
  //   let node = this.root;
  //   const nodeStack = [];
  //   const prefixStack = [];
  //   let token;
  //   let i;
  //   let l;

  //   const isString = this.mode === 'string';

  //   // Resolving initial prefix
  //   if (prefix) {
  //     for (i = 0, l = prefix.length; i < l; i++) {
  //       token = prefix[i];
  //       node = node[token];

  //       // If the prefix does not exist, we return an empty iterator
  //       if (typeof node === 'undefined')
  //         return Iterator.empty();
  //     }
  //   }
  //   else {
  //     prefix = isString ? '' : [];
  //   }

  //   nodeStack.push(node);
  //   prefixStack.push(prefix);

  //   return new Iterator(() => {
  //     let currentNode;
  //     let currentPrefix;
  //     let hasValue = false;
  //     let k;

  //     while (nodeStack.length) {
  //       currentNode = nodeStack.pop();
  //       currentPrefix = prefixStack.pop();

  //       for (k in currentNode) {
  //         if (k === SENTINEL) {
  //           hasValue = true;
  //           continue;
  //         }

  //         nodeStack.push(currentNode[k]);
  //         prefixStack.push(isString ? currentPrefix + k : currentPrefix.concat(k));
  //       }

  //       if (hasValue)
  //         return { done: false, value: currentPrefix };
  //     }

  //     return { done: true };
  //   });
  // }

  /**
   * Convenience known methods.
   */
  // inspect() {
  //   const proxy = new Set();

  //   const iterator = this.prefixes();
  //   let step;

  //   while ((step = iterator.next(), !step.done))
  //     proxy.add(step.value);

  //   // Trick so that node displays the name of the constructor
  //   Object.defineProperty(proxy, 'constructor', {
  //     value: Trie,
  //     enumerable: false
  //   });

  //   return proxy;
  // }
  /**
   * Static .from function taking an arbitrary iterable & converting it into
   * a trie.
   *
   * @param  {string[]} iterable   - Target iterable.
   * @return {Trie}
   */
  static from = iterable => {
    const trie = new Trie();
    iterable.forEach(i => trie.add(i));
    return trie;
  };
}

/**
 * Exporting.
 */
module.exports.SENTINEL = SENTINEL;
module.exports = Trie;
