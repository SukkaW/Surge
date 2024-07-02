const WORDEND = Symbol('wordEnd');
const FAIL = Symbol('fail');

type Node = Map<string, Node> & {
  [WORDEND]: boolean,
  [FAIL]: Node | undefined
};

const createNode = (): Node => {
  const node = new Map<string, Node | undefined>() as Node;
  node[WORDEND] = false;
  node[FAIL] = undefined;
  return node;
};

const createKeywordFilter = (keys: string[] | Set<string>) => {
  const root = createNode();

  // Create a trie with extra fields and information
  const put = (key: string) => {
    const len = key.length;

    let node = root;

    for (let idx = 0; idx < len; idx++) {
      const char = key[idx];

      if (node.has(char)) {
        node = node.get(char)!;
      } else {
        const newNode = createNode();
        node.set(char, newNode);
        node = newNode;
      }
    }

    // If a new node is created, mark it as a word end when loop finish
    if (node !== root) {
      node[WORDEND] = true;
    }
  };

  keys.forEach(put);

  // const build = () => {
  const queue: Node[] = [root];

  while (queue.length) {
    const beginNode = queue.pop()!;

    beginNode.forEach((node, char) => {
      let failNode = beginNode[FAIL];

      while (failNode && !failNode.has(char)) {
        failNode = failNode[FAIL];
      }

      node[FAIL] = failNode ? failNode.get(char) : root;

      queue.push(node);
    });
  }
  // };
  // build();

  return (text: string) => {
    let node: Node | undefined = root;

    for (let i = 0, textLen = text.length; i < textLen; i++) {
      const char = text[i];

      while (node && !node.has(char)) {
        node = node[FAIL];
      }

      node = node ? node.get(char)! : root;

      if (node[WORDEND]) {
        return true;
      }
    }

    return false;
  };
};

export default createKeywordFilter;
