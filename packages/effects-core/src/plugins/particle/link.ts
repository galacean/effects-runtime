class LinkNode<T> {
  next: LinkNode<T> | null;
  pre: LinkNode<T> | null;

  constructor (
    public content: T
  ) {
  }

}

export class Link<T> {
  first: LinkNode<T>;
  last: LinkNode<T>;
  length = 0;

  constructor (
    private readonly sort: (a: T, b: T) => number
  ) { }

  findNodeByContent (filter: (d: T) => boolean) {
    let node = this.first;

    if (node) {
      do {
        if (filter(node.content)) {
          return node;
        }
        // @ts-expect-error
        // eslint-disable-next-line no-cond-assign
      } while (node = node.next);
    }
  }

  private insertNode (a: LinkNode<T>, next: LinkNode<T>) {
    const b = a.next;

    a.next = next;
    next.pre = a;
    next.next = b;
    if (b) {
      b.pre = next;
    }
    // a -> next -> b
  }

  shiftNode (content: T): LinkNode<T> | undefined {
    const node = new LinkNode(content);

    this.length++;
    if (this.length === 1) {
      return this.first = this.last = node;
    }
    let current = this.first;

    while (current) {
      if (this.sort(current.content, node.content) <= 0) {
        if (current.next) {
          current = current.next;
        } else {
          this.insertNode(current, node);

          return this.last = node;
        }
      } else {
        if (current.pre) {
          this.insertNode(current.pre, node);
        } else {
          this.first = node;
          node.next = current;
          current.pre = node;
        }

        return node;
      }
    }
  }

  pushNode (content: T): LinkNode<T> | undefined {
    const node = new LinkNode(content);

    this.length++;
    if (this.length === 1) {
      return this.last = this.first = node;
    }
    let current = this.last;

    while (current) {
      if (this.sort(node.content, current.content) <= 0) {
        if (this.first === current) {
          current.pre = node;
          node.next = current;

          return this.first = node;
        } else {
          // @ts-expect-error
          current = current.pre;
        }
      } else {
        this.insertNode(current, node);
        if (current === this.last) {
          this.last = node;
        }

        return node;
      }
    }
  }

  removeNode (node: LinkNode<T>) {
    let current = this.first;

    this.length--;
    if (current === node) {
      // @ts-expect-error
      const a = this.first = current.next;

      if (a) {
        a.pre = null;
      }
    } else if ((current = this.last) === node) {
      // @ts-expect-error
      const a = this.last = current.pre;

      if (a) {
        a.next = null;
      }
    } else if (node) {
      const pre = node.pre;
      const next = node.next;

      // @ts-expect-error
      pre.next = next;
      if (next) {
        next.pre = pre;
      }
    }
    node.pre = null;
    node.next = null;
  }

  forEach (func: (content: T, index: number) => void, thisObj?: any) {
    let node = this.first;
    let i = 0;

    if (node) {
      do {
        func.call(thisObj || this, node.content, i++);
        // @ts-expect-error
        // eslint-disable-next-line no-cond-assign
      } while (node = node.next);
    }
  }

  forEachReverse (func: (content: T, index: number) => void, thisObj?: any) {
    let node = this.last;
    let i = this.length - 1;

    if (node) {
      do {
        func.call(thisObj || this, node.content, i--);
        // @ts-expect-error
        // eslint-disable-next-line no-cond-assign
      } while (node = node.pre);
    }
  }

}
