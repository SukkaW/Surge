/**
 * @typedef {Object} Node
 * @prop {number} [depth = 0]
 * @prop {string} key
 * @prop {boolean} [word = false]
 * @prop {Record<string, Node>} [children={}]
 * @prop {Node} [fail]
 * @prop {number} [count=0]
 */

/**
 * @param {string} key
 * @param {number} depth
 * @returns {Node}
 */
const createNode = (key, depth = 0) => ({
  depth,
  key,
  word: false,
  children: {},
  fail: undefined,
  count: 0
});

/**
 * @param {string[]} keys
 */
const createKeywordFilter = (keys) => {
  const root = createNode('root');

  const build = () => {
    /** @type {Node[]} */
    const queue = [];
    queue.push(root);

    let idx = 0;
    while (queue.length > idx) {
      const beginNode = queue[idx];
      const map = beginNode.children;
      // eslint-disable-next-line guard-for-in -- plain object
      for (const key in beginNode.children) {
        const node = map[key];
        let failNode = beginNode.fail;

        while (failNode && !failNode.children[key]) {
          failNode = failNode.fail;
        }

        node.fail = failNode?.children[key] || root;

        queue.push(node);
      }

      idx++;
    }
  };

  /**
   * @param {string} key
   * @param {number} len
   */
  const put = (key, len) => {
    let node = root;
    const lastIdx = len - 1;
    node.count++;
    for (let idx = 0; idx < len; idx++) {
      const val = key[idx];
      const nextNode = node.children[val];

      if (nextNode) {
        nextNode.count++;
        node = nextNode;
      } else {
        const newNode = createNode(val, idx + 1);
        newNode.count = 1;
        node.children[val] = newNode;
        node = newNode;
      }

      if (lastIdx === idx && node.depth) {
        node.word = true;
      }
    }
  };

  /**
   * @param {string} key
   */
  const add = (key) => {
    const len = key.length;
    put(key, len);
    build();

    return true;
  };

  for (let idx = 0; idx < keys.length; idx++) {
    add(keys[idx], false);
  }

  build();

  /**
   * @param {string} text
   * @returns {boolean}
   */
  const search = (text) => {
    let node = root;
    /** @type {string[]} */
    const fText = [];
    /** @type {string[]} */
    const oText = [];

    for (let i = 0, textLen = text.length; i < textLen; i++) {
      // const key = text.charAt(i);
      const key = text[i];

      while (node && !node?.children[key]) {
        node = node?.fail;
      }
      node = node?.children[key] || root;

      fText.push(key);
      oText.push(key);

      if (node.word) {
        return true;
      }
    }

    return false;
  };

  return {
    search
  };
};

module.exports = createKeywordFilter;
