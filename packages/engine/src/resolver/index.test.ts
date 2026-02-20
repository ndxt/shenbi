import { describe, expect, it } from 'vitest';
import { Fragment } from 'react';
import { createResolver, antdResolver } from './index';

describe('createResolver', () => {
  it('直接组件: resolve 已注册组件', () => {
    const Button = () => null;
    const resolver = createResolver({ Button });
    expect(resolver.resolve('Button')).toBe(Button);
  });

  it('子组件: resolve("Form.Item") 返回 Form.Item', () => {
    const FormItem = () => null;
    const Form = Object.assign(() => null, { Item: FormItem });
    const resolver = createResolver({ Form });
    expect(resolver.resolve('Form.Item')).toBe(FormItem);
  });

  it('内置特殊: resolve("__fragment") 返回 React.Fragment', () => {
    const resolver = createResolver();
    expect(resolver.resolve('__fragment')).toBe(Fragment);
  });

  it('未注册: resolve("Unknown") 返回 null', () => {
    const resolver = createResolver();
    expect(resolver.resolve('Unknown')).toBeNull();
  });

  it('批量注册: registerAll 一次注册多个', () => {
    const A = () => null;
    const B = () => null;
    const resolver = createResolver();
    resolver.registerAll({ A, B });
    expect(resolver.resolve('A')).toBe(A);
    expect(resolver.resolve('B')).toBe(B);
  });

  it('后注册覆盖: 同名注册覆盖旧值', () => {
    const Old = () => null;
    const New = () => null;
    const resolver = createResolver({ Button: Old });
    resolver.register('Button', New);
    expect(resolver.resolve('Button')).toBe(New);
  });

  it('has: 已注册返回 true，未注册返回 false', () => {
    const resolver = createResolver({ Button: () => null });
    expect(resolver.has('Button')).toBe(true);
    expect(resolver.has('Unknown')).toBe(false);
    expect(resolver.has('__fragment')).toBe(true);
  });
});

describe('antdResolver', () => {
  it('从 antd 模块批量注册组件', () => {
    const Button = () => null;
    const Input = () => null;
    const Select = () => null;
    const Card = () => null;
    const Tag = () => null;
    const Alert = () => null;
    const fakeAntd = { Button, Input, Select, Card, Tag, Alert };

    const resolver = antdResolver(fakeAntd);
    expect(resolver.resolve('Button')).toBe(Button);
    expect(resolver.resolve('Input')).toBe(Input);
    expect(resolver.resolve('Select')).toBe(Select);
    expect(resolver.resolve('Card')).toBe(Card);
    expect(resolver.resolve('Tag')).toBe(Tag);
    expect(resolver.resolve('Alert')).toBe(Alert);
  });

  it('子组件通过点号路径解析', () => {
    const FormItem = () => null;
    const Form = Object.assign(() => null, { Item: FormItem });
    const resolver = antdResolver({ Form });
    expect(resolver.resolve('Form.Item')).toBe(FormItem);
  });

  it('忽略 antd 模块中不在注册表的属性', () => {
    const resolver = antdResolver({ __esModule: true, version: '6.3.0' } as any);
    expect(resolver.resolve('__esModule')).toBeNull();
  });
});
