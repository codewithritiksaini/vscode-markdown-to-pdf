/**
 * PreviewProvider – thin orchestrator delegating browser preview requests
 * to the Pipeline PreviewService.
 */

import * as vscode from 'vscode';
import { MarkdownDocument } from './types';
import { PreviewService } from './services/PreviewService';
import { ServiceContainer } from './services/ServiceContainer';

export class PreviewProvider {
  private readonly previewService: PreviewService;

  constructor(_context: vscode.ExtensionContext, container: ServiceContainer) {
    this.previewService = container.get<PreviewService>('PreviewService');
  }

  /**
   * Delegates the browser preview generation to the decoupled PreviewService.
   */
  async openInBrowser(doc: MarkdownDocument): Promise<void> {
    await this.previewService.openInBrowser(doc);
  }

  dispose(): void {
    // Active pipeline is stateless
  }
}
