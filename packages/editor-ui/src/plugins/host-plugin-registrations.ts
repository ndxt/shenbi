export interface HostPluginRegistration<TContext, TPlugin> {
  id: string;
  order: number;
  when: (context: TContext) => boolean;
  create: (context: TContext) => TPlugin;
}

function sortRegistrations<TContext, TPlugin>(
  registrations: readonly HostPluginRegistration<TContext, TPlugin>[],
) {
  return [...registrations].sort((left, right) => left.order - right.order);
}

export function getEnabledHostPluginRegistrationIds<TContext, TPlugin>(
  registrations: readonly HostPluginRegistration<TContext, TPlugin>[],
  context: TContext,
): string[] {
  return sortRegistrations(registrations)
    .filter((registration) => registration.when(context))
    .map((registration) => registration.id);
}

export function resolveHostPluginRegistrations<TContext, TPlugin>(
  registrations: readonly HostPluginRegistration<TContext, TPlugin>[],
  context: TContext,
): TPlugin[] {
  return sortRegistrations(registrations)
    .filter((registration) => registration.when(context))
    .map((registration) => registration.create(context));
}
