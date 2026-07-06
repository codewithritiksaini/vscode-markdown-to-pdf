export class ServiceContainer {
    private readonly services = new Map<string, any>();

    register<T>(name: string, service: T): void {
        this.services.set(name, service);
    }

    get<T>(name: string): T {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service not registered: ${name}`);
        }
        return service;
    }
}
