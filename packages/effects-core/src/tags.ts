/**
 * 层级标签，名称以点号分隔，例如 `Effect.Fire.Loop`。
 * 使用 Tags.get 创建标签；编号仅在当前运行时有效，序列化时应保存名称。
 */
export class Tag {
  /** 空标签。 */
  static get empty (): Tag {
    return new Tag();
  }

  /** @param index - 注册编号，0 表示空标签。 */
  constructor (public index = 0) { }

  /** 编号是否非零 */
  get isValid (): boolean {
    return this.index !== 0;
  }

  equals (other: Tag | string): boolean {
    return typeof other === 'string' ? this.toString() === other : this.index === other.index;
  }

  toString (): string {
    return Tags.list[this.index - 1] ?? '';
  }
}

/** 标签注册表及精确、层级匹配工具。名称区分大小写。 */
export class Tags {
  /** 全局标签名称列表，标签编号为列表索引加一。 */
  static list: string[] = [];

  /** 获取或注册标签，同时注册其父标签。空名称返回空标签。 */
  static get (name: string): Tag {
    if (!name) {
      return Tag.empty;
    }
    const existing = Tags.find(name);

    if (existing.index !== 0) {
      return existing;
    }
    const dot = name.lastIndexOf('.');

    if (dot !== -1) {
      Tags.get(name.substring(0, dot));
    }
    Tags.list.push(name);

    return new Tag(Tags.list.length);
  }

  /** 查找已注册标签，不存在时返回空标签，不修改注册表。 */
  static find (name: string): Tag {
    return new Tag(Tags.list.indexOf(name) + 1);
  }

  /** 按名称前缀获取标签，按编号排除自身；空标签返回全部已注册标签。 */
  static getSubTags (tag: Tag): Tag[] {
    const name = tag.toString();
    const result: Tag[] = [];

    for (let index = 0; index < Tags.list.length; index++) {
      if (Tags.list[index].startsWith(name) && tag.index !== index + 1) {
        result.push(new Tag(index + 1));
      }
    }

    return result;
  }

  /** 层级匹配，例如列表中的 `A.B` 可以匹配查询 `A`。 */
  static hasTag (list: readonly Tag[], tag: Tag): boolean {
    const name = tag.toString();

    return tag.index !== 0 && list.some(candidate => candidate.equals(tag) || Tags.isChildOf(candidate.toString(), name));
  }

  /** 精确匹配，不匹配父标签。 */
  static hasTagExact (list: readonly Tag[], tag: Tag): boolean {
    return tag.index !== 0 && list.some(candidate => candidate.equals(tag));
  }

  /** 是否层级匹配任一查询标签；空查询返回 false。 */
  static hasAny (list: readonly Tag[], tags: readonly Tag[]): boolean {
    return tags.some(tag => Tags.hasTag(list, tag));
  }

  /** 是否精确匹配任一查询标签；空查询返回 false。 */
  static hasAnyExact (list: readonly Tag[], tags: readonly Tag[]): boolean {
    return tags.some(tag => Tags.hasTagExact(list, tag));
  }

  /** 是否层级匹配所有查询标签；空查询返回 true。 */
  static hasAll (list: readonly Tag[], tags: readonly Tag[]): boolean {
    return tags.every(tag => Tags.hasTag(list, tag));
  }

  /** 是否精确匹配所有查询标签；空查询返回 true。 */
  static hasAllExact (list: readonly Tag[], tags: readonly Tag[]): boolean {
    return tags.every(tag => Tags.hasTagExact(list, tag));
  }

  private static isChildOf (name: string, parent: string): boolean {
    return name.length > parent.length + 1 && name.startsWith(parent + '.');
  }
}
