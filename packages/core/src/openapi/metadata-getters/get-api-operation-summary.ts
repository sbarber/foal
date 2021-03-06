import { Class } from '../../core';
import { getMetadata } from '../../core/routes/utils';

export function getApiOperationSummary(
  controllerClass: Class, propertyKey?: string
): string | ((controller: any) => string) | undefined {
  return getMetadata('api:operation:summary', controllerClass, propertyKey);
}
