class Node<T> {
  next?: Node<T>;

  constructor(public readonly value: T) {}
}

export default class FIFO<T> {
  private head?: Node<T>;
  private tail?: Node<T>;
  public $size = 0;

  constructor() {
    this.clear();
  }

  enqueue(value: T) {
    const node = new Node<T>(value);

    if (this.head) {
      this.tail!.next = node;
      this.tail = node;
    } else {
      this.head = node;
      this.tail = node;
    }

    this.$size++;
  }

  dequeue() {
    const current = this.head;
    if (!current) {
      return;
    }

    this.head = this.head!.next;
    this.$size--;
    return current.value;
  }

  peek() {
    return this.head?.value;
  }

  clear() {
    this.head = undefined;
    this.tail = undefined;
    this.$size = 0;
  }

  get size() {
    return this.$size;
  }

  *[Symbol.iterator]() {
    let current = this.head;

    while (current) {
      yield current.value;
      current = current.next;
    }
  }
}
