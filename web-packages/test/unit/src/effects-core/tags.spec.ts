import { Engine, Tag, Tags, VFXItem } from '@galacean/effects';

const { expect } = chai;

describe('core/tags', () => {
  it('registers parents and returns tag values without registering failed lookups', () => {
    const tag = Tags.get('TagsTest.Effect.Fire');
    const names = Tags.list.slice();

    expect(tag.isValid).to.equal(true);
    expect(Tags.get('TagsTest.Effect.Fire').equals(tag)).to.equal(true);
    expect(Tags.get('TagsTest.Effect.Fire')).not.to.equal(tag);
    expect(Tags.find('TagsTest.Effect').isValid).to.equal(true);
    expect(Tags.find('TagsTest').isValid).to.equal(true);
    expect(Tags.find('TagsTest.Unknown')).to.deep.equal(Tag.empty);
    expect(Tags.get('')).to.deep.equal(Tag.empty);
    expect(Tag.empty.isValid).to.equal(false);
    expect(Tags.list).to.deep.equal(names);
  });

  it('checks nonzero indices and compares unregistered tags by index', () => {
    const tag = new Tag(0xffffffff);
    const other = new Tag(0xfffffffe);

    expect(tag.isValid).to.equal(true);
    expect(tag.toString()).to.equal('');
    expect(Tags.hasTag([tag], new Tag(tag.index))).to.equal(true);
    expect(Tags.hasTagExact([tag], new Tag(tag.index))).to.equal(true);
    expect(Tags.hasTag([tag], other)).to.equal(false);
    expect(Tags.hasTagExact([tag], other)).to.equal(false);
  });

  it('returns independent tag values and reflects changes to the global list', () => {
    const tag = Tags.get('TagsTest.Values');
    const index = tag.index;
    const empty = Tag.empty;

    tag.index = 0;
    empty.index = index;
    expect(Tags.find('TagsTest.Values').index).to.equal(index);
    expect(Tag.empty.index).to.equal(0);
    const original = Tags.list[index - 1];

    try {
      Tags.list[index - 1] = 'TagsTest.Renamed';
      expect(Tags.find(original).index).to.equal(0);
      expect(Tags.find('TagsTest.Renamed').index).to.equal(index);
      expect(new Tag(index).toString()).to.equal('TagsTest.Renamed');
    } finally {
      Tags.list[index - 1] = original;
    }
  });

  it('matches ancestors only at dot boundaries and preserves case', () => {
    const tags = [Tags.get('TagsTest.Match.Fire.Loop')];

    expect(Tags.hasTag(tags, Tags.get('TagsTest.Match.Fire'))).to.equal(true);
    expect(Tags.hasTagExact(tags, Tags.get('TagsTest.Match.Fire'))).to.equal(false);
    expect(Tags.hasTagExact(tags, new Tag(tags[0].index))).to.equal(true);
    expect(Tags.hasTag(tags, Tags.get('TagsTest.Match.Fir'))).to.equal(false);
    expect(Tags.hasTag(tags, Tags.get('TagsTest.Match.fire'))).to.equal(false);
    expect(Tags.hasTag(tags, Tags.get('TagsTest.Match.Fire.Loop.Child'))).to.equal(false);
    expect(Tags.hasTag(tags, Tag.empty)).to.equal(false);
    expect(Tags.hasTagExact([Tag.empty], Tag.empty)).to.equal(false);
  });

  it('finds prefixes including siblings and returns all tags for an empty parent', () => {
    const parent = Tags.get('TagsTest.Children.Fire');
    const child = Tags.get('TagsTest.Children.Fire.Loop');
    const grandchild = Tags.get('TagsTest.Children.Fire.Loop.Fast');

    const sibling = Tags.get('TagsTest.Children.Fireball');

    expect(Tags.getSubTags(parent)).to.deep.equal([child, grandchild, sibling]);
    expect(Tags.getSubTags(Tag.empty).map(tag => tag.toString())).to.deep.equal(Tags.list);
  });

  it('supports any/all queries and empty query semantics', () => {
    const tags = [Tags.get('TagsTest.Query.A.B'), Tags.get('TagsTest.Query.C')];
    const query = [Tags.get('TagsTest.Query.A'), Tags.get('TagsTest.Query.C')];

    expect(Tags.hasAny(tags, query)).to.equal(true);
    expect(Tags.hasAll(tags, query)).to.equal(true);
    expect(Tags.hasAnyExact(tags, query)).to.equal(true);
    expect(Tags.hasAllExact(tags, query)).to.equal(false);
    expect(Tags.hasAny(tags, [Tags.get('TagsTest.Missing')])).to.equal(false);
    expect(Tags.hasAnyExact(tags, [Tags.get('TagsTest.Query.A')])).to.equal(false);
    expect(Tags.hasAll(tags, [...query, Tags.get('TagsTest.Missing')])).to.equal(false);
    expect(Tags.hasAllExact(tags, tags)).to.equal(true);
    expect(Tags.hasAny([], [])).to.equal(false);
    expect(Tags.hasAnyExact([], [])).to.equal(false);
    expect(Tags.hasAll([], [])).to.equal(true);
    expect(Tags.hasAllExact([], [])).to.equal(true);
    expect(Tags.hasAll([], query)).to.equal(false);
  });
});

describe('core/vfx-item/tags', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = Engine.create(document.createElement('canvas'), { manualRender: true });
  });

  afterEach(() => {
    engine.dispose();
  });

  it('adds unique tags and matches tags or names exactly', () => {
    const item = new VFXItem(engine);
    const tag = Tags.get('TagsTest.Item.Fire');

    expect(item.hasTag()).to.equal(false);
    item.addTag(tag);
    item.addTag(new Tag(tag.index));
    expect(item.tags).to.deep.equal([tag]);
    expect(item.hasTag()).to.equal(true);
    expect(item.hasTag(tag)).to.equal(true);
    expect(item.hasTag(tag.toString())).to.equal(true);
    expect(item.hasTag('TagsTest.Item')).to.equal(false);
    item.removeTag(Tags.get('TagsTest.Item'));
    expect(item.hasTag(tag)).to.equal(true);
    item.removeTag(new Tag(tag.index));
    expect(item.hasTag()).to.equal(false);
  });

  it('copies tag values when adding them to an item', () => {
    const item = new VFXItem(engine);
    const tag = Tags.get('TagsTest.Item.Value');
    const index = tag.index;

    item.addTag(tag);
    tag.index = 0;
    expect(item.hasTag(new Tag(index))).to.equal(true);
    expect(item.hasTag(Tag.empty)).to.equal(false);
  });

  it('accepts empty and unregistered tags and compares their indices', () => {
    const item = new VFXItem(engine);
    const unregistered = new Tag(0xffffffff);

    item.addTag(Tag.empty);
    item.addTag(new Tag());
    expect(item.tags).to.deep.equal([Tag.empty]);
    expect(item.hasTag()).to.equal(true);
    expect(item.hasTag(Tag.empty)).to.equal(true);
    expect(item.hasTag('')).to.equal(true);
    item.addTag(unregistered);
    expect(item.hasTag(new Tag(unregistered.index))).to.equal(true);
    item.removeTag(Tag.empty);
    expect(item.hasTag(Tag.empty)).to.equal(false);
    expect(item.hasTag(unregistered)).to.equal(true);
  });

  it('removes only the first matching tag and leaves missing tags unchanged', () => {
    const item = new VFXItem(engine);
    const tag = Tags.get('TagsTest.Item.Duplicate');
    const other = Tags.get('TagsTest.Item.Other');

    item.tags.push(tag, other, new Tag(tag.index));
    item.removeTag(new Tag(tag.index));
    expect(item.tags).to.deep.equal([other, tag]);
    item.removeTag(Tag.empty);
    expect(item.tags).to.deep.equal([other, tag]);
  });

  it('adds recursively to self and descendants without affecting other items', () => {
    const root = new VFXItem(engine);
    const child = new VFXItem(engine);
    const grandchild = new VFXItem(engine);
    const other = new VFXItem(engine);

    child.setParent(root);
    grandchild.setParent(child);
    child.addTag(Tags.get('TagsTest.Recursive'));
    root.addTagRecursive(Tags.get('TagsTest.Recursive'));
    for (const item of [root, child, grandchild]) {
      expect(item.tags.length).to.equal(1);
      expect(item.hasTag('TagsTest.Recursive')).to.equal(true);
    }
    child.removeTag(Tags.get('TagsTest.Recursive'));
    expect(root.hasTag()).to.equal(true);
    expect(grandchild.hasTag()).to.equal(true);
    expect(other.hasTag()).to.equal(false);
  });

  it('visits descendants before parents and adds empty tags recursively', () => {
    const visited: VFXItem[] = [];

    class TrackedItem extends VFXItem {
      override addTag (tag: Tag): void {
        visited.push(this);
        super.addTag(tag);
      }
    }

    const root = new TrackedItem(engine);
    const child = new TrackedItem(engine);
    const grandchild = new TrackedItem(engine);
    const sibling = new TrackedItem(engine);

    child.setParent(root);
    grandchild.setParent(child);
    sibling.setParent(root);
    root.addTagRecursive(Tag.empty);
    expect(visited).to.deep.equal([grandchild, child, sibling, root]);
    for (const item of visited) {
      expect(item.hasTag(Tag.empty)).to.equal(true);
    }
  });
});
