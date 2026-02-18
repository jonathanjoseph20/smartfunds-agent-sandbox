declare module "hono" {
  export class Hono {
    get(path: string, handler: (c: any) => any): void;
    post(path: string, handler: (c: any) => any): void;
  }
}
