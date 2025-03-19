import { Contract } from '@algorandfoundation/algorand-typescript'

export class BizKor extends Contract {
  public hello(name: string): string {
    return `Hello, ${name}`
  }
}
