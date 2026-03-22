import { describe, expect, it } from 'vitest';
import {
  getEnabledHostPluginRegistrationIds,
  resolveHostPluginRegistrations,
  type HostPluginRegistration,
} from './host-plugin-registrations';

describe('host-plugin-registrations', () => {
  it('按顺序解析启用的注册项', () => {
    const registrations: HostPluginRegistration<{ enabled: boolean }, string>[] = [
      {
        id: 'late',
        order: 20,
        when: (context) => context.enabled,
        create: () => 'late-plugin',
      },
      {
        id: 'early',
        order: 10,
        when: () => true,
        create: () => 'early-plugin',
      },
    ];

    expect(getEnabledHostPluginRegistrationIds(registrations, { enabled: true })).toEqual([
      'early',
      'late',
    ]);
    expect(resolveHostPluginRegistrations(registrations, { enabled: true })).toEqual([
      'early-plugin',
      'late-plugin',
    ]);
  });

  it('会排除未启用的注册项', () => {
    const registrations: HostPluginRegistration<{ enabled: boolean }, string>[] = [
      {
        id: 'disabled',
        order: 10,
        when: (context) => context.enabled,
        create: () => 'disabled-plugin',
      },
    ];

    expect(getEnabledHostPluginRegistrationIds(registrations, { enabled: false })).toEqual([]);
    expect(resolveHostPluginRegistrations(registrations, { enabled: false })).toEqual([]);
  });
});
