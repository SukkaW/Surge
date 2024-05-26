interface Node {
  /** @default false */
  wordEnd: boolean,
  children: Map<string, Node | undefined>,
  fail: Node | undefined
}

const createNode = (): Node => ({
  wordEnd: false,
  children: new Map(),
  fail: undefined
});

const createKeywordFilter = (keys: string[] | Set<string>) => {
  const root = createNode();

  const put = (key: string, len = key.length) => {
    let node = root;
    const lastIdx = len - 1;

    for (let idx = 0; idx < len; idx++) {
      const char = key[idx];

      if (node.children.has(char)) {
        node = node.children.get(char)!;
      } else {
        const newNode = createNode();
        node.children.set(char, newNode);
        node = newNode;
      }

      if (lastIdx === idx && node !== root) {
        node.wordEnd = true;
      }
    }
  };

  keys.forEach(k => put(k));

  // const build = () => {
  const queue: Node[] = [];
  queue.push(root);

  let idx = 0;
  while (queue.length > idx) {
    const beginNode = queue[idx];
    const children = beginNode.children;

    children.forEach((node, char) => {
      let failNode = beginNode.fail;

      while (failNode && !failNode.children.has(char)) {
        failNode = failNode.fail;
      }

      if (node) {
        node.fail = failNode?.children.get(char) || root;

        queue.push(node);
      }
    });

    idx++;
  }
  // };
  // build();

  return (text: string) => {
    let node: Node | undefined = root;

    for (let i = 0, textLen = text.length; i < textLen; i++) {
      // const key = text.charAt(i);
      const char = text[i];

      while (node && !node.children.has(char)) {
        node = node.fail;
      }
      node = node?.children.get(char) || root;

      if (node.wordEnd) {
        return true;
      }
    }

    return false;
  };
};

export default createKeywordFilter;
