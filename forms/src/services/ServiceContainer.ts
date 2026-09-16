import { IAuthService } from './interfaces/IAuthService';
import { IFormService } from './interfaces/IFormService';
import { IResponseService } from './interfaces/IResponseService';
import { MockAuthService } from './mock/MockAuthService';
import { RayfinAuthService } from './rayfin/RayfinAuthService';
import { RayfinClientService } from './rayfin/RayfinClientService';
import { RayfinFormService } from './rayfin/RayfinFormService';
import { RayfinResponseService } from './rayfin/RayfinResponseService';

function isLocalBackend(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly authService: IAuthService;
  public readonly formService: IFormService;
  public readonly responseService: IResponseService;

  private constructor(
    authService: IAuthService,
    formService: IFormService,
    responseService: IResponseService
  ) {
    this.authService = authService;
    this.formService = formService;
    this.responseService = responseService;
  }

  static create(): ServiceContainer {
    if (!ServiceContainer.instance) {
      const apiUrl =
        import.meta.env.VITE_RAYFIN_API_URL || 'http://localhost:5168';
      const localDev = isLocalBackend(apiUrl);

      const publishableKey = import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY;

      if (!publishableKey && !localDev) {
        throw new Error(
          'VITE_RAYFIN_PUBLISHABLE_KEY environment variable is required'
        );
      }

      const projectId = import.meta.env.VITE_FABRIC_ITEM_ID;

      const rayfinClientService = RayfinClientService.getInstance();
      rayfinClientService.initialize(
        apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
        publishableKey ?? 'local-dev-key',
        projectId
      );

      let authService: IAuthService;

      if (localDev) {
        authService = new MockAuthService();
      } else {
        const workspaceId = import.meta.env.VITE_FABRIC_WORKSPACE_ID;
        const fabricPortalUrl = import.meta.env.VITE_FABRIC_PORTAL_URL;

        authService = new RayfinAuthService({
          workspaceId: workspaceId || '',
          projectId: projectId || '',
          fabricPortalUrl: fabricPortalUrl || '',
        });
      }

      ServiceContainer.instance = new ServiceContainer(
        authService,
        new RayfinFormService(),
        new RayfinResponseService()
      );
    }

    return ServiceContainer.instance;
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error('ServiceContainer not initialized. Call create() first.');
    }
    return ServiceContainer.instance;
  }

  static reset(): void {
    ServiceContainer.instance = null;
    RayfinClientService.reset();
  }
}
