import { CaptionedBlockComponent } from '@blocksuite/affine-components/caption';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { toast } from '@blocksuite/affine-components/toast';
import { RefNodeSlotsProvider } from '@blocksuite/affine-inline-reference';
import type {
  DatabaseBlockModel,
  LinkedDatabaseBlockModel,
} from '@blocksuite/affine-model';
import {
  DocModeProvider,
  NotificationProvider,
} from '@blocksuite/affine-shared/services';
import {
  DataViewRootUILogic,
  type DataViewSelection,
  type DataViewWidget,
  type DataViewWidgetProps,
  defineUniComponent,
  lazy,
  renderUniLit,
} from '@blocksuite/data-view';
import { widgetPresets } from '@blocksuite/data-view/widget-presets';
import {
  DeleteIcon,
  LinkIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/lit';
import { type BlockComponent, BlockSelection } from '@blocksuite/std';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@blocksuite/std/inline';
import { computed, signal } from '@preact/signals-core';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { DatabaseSelection } from '../../database/src/selection.js';
import { currentViewStorage } from '../../database/src/utils/current-view.js';
import { LinkedDatabaseBlockDataSource } from './data-source.js';

export class LinkedDatabaseBlockComponent extends CaptionedBlockComponent<LinkedDatabaseBlockModel> {
  static override styles = css`
    .linked-db-header-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      color: var(--affine-text-secondary-color);
      font-size: 13px;
    }
    .linked-db-source-link {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      text-decoration: underline;
      color: var(--affine-link-color);
    }
    .linked-db-error {
      padding: 24px;
      text-align: center;
      color: var(--affine-text-secondary-color);
      border: 1.5px dashed var(--affine-border-color);
      border-radius: 8px;
      margin: 8px 0;
    }
  `;

  private readonly _dataSource = lazy(() => {
    const sourceId = this.model.props.sourceDatabaseId;
    const sourceModel = this.store.getBlock(sourceId)?.model as
      | DatabaseBlockModel
      | undefined;
    if (!sourceModel) return null;
    const ds = new LinkedDatabaseBlockDataSource(this.model, sourceModel);
    const id = currentViewStorage.getCurrentView(this.model.id);
    if (id && ds.viewManager.viewGet(id)) {
      ds.viewManager.setCurrentView(id);
    }
    return ds;
  });

  private readonly _viewSelection$ = computed(() => {
    const databaseSelection = this.selection.value.find(
      (selection): selection is DatabaseSelection => {
        if (selection.blockId !== this.blockId) return false;
        return selection instanceof DatabaseSelection;
      }
    );
    return databaseSelection?.viewSelection;
  });

  private readonly _setSelection = (
    selection: DataViewSelection | undefined
  ) => {
    if (selection) getSelection()?.removeAllRanges();
    this.selection.setGroup(
      'note',
      selection
        ? [
            new DatabaseSelection({
              blockId: this.blockId,
              viewSelection: selection,
            }),
          ]
        : []
    );
  };

  private readonly _virtualPadding$ = signal(0);

  private readonly _toolsWidget: DataViewWidget = widgetPresets.createTools({
    table: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    kanban: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
  });

  private _renderOps() {
    return html`
      <div
        class="affine-database-ops"
        @click="${(e: MouseEvent) => {
          popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
            options: {
              items: [
                menu.group({
                  items: [
                    menu.action({
                      prefix: DeleteIcon(),
                      class: { 'delete-item': true },
                      name: 'Remove linked view',
                      select: () => {
                        this.store.deleteBlock(this.model);
                      },
                    }),
                  ],
                }),
              ],
            },
          });
        }}"
      >
        ${MoreHorizontalIcon()}
      </div>
    `;
  }

  private _renderHeader(props: DataViewWidgetProps, sourceTitle: string) {
    const sourceId = this.model.props.sourceDatabaseId;
    return html`
      <div style="padding: 4px 0;">
        <div class="linked-db-header-bar">
          <span
            class="linked-db-source-link"
            @click="${() => {
              // Navigate to the block containing the source database.
              const sourceBlock = this.store.getBlock(sourceId);
              if (sourceBlock) {
                this.std.selection.setGroup('note', [
                  new BlockSelection({ blockId: sourceId }),
                ]);
              }
            }}"
          >
            ${LinkIcon()} ${sourceTitle}
          </span>
          ${this._renderOps()}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${renderUniLit(widgetPresets.viewBar, {
            ...props,
            onChangeView: (id: string) => {
              currentViewStorage.setCurrentView(this.blockId, id);
            },
          })}
          ${renderUniLit(this._toolsWidget, props)}
        </div>
        ${renderUniLit(widgetPresets.quickSettingBar, props)}
      </div>
    `;
  }

  private readonly _headerWidget: DataViewWidget = defineUniComponent(
    (props: DataViewWidgetProps) => {
      const ds = this._dataSource.value;
      if (!ds) return html``;
      const sourceTitle = ds.sourceTitle$.value;
      return this._renderHeader(props, sourceTitle);
    }
  );

  private readonly _dataViewRootLogic = lazy(() => {
    const ds = this._dataSource.value;
    if (!ds) return null;
    return new DataViewRootUILogic({
      virtualPadding$: this._virtualPadding$,
      bindHotkey: hotkeys => ({
        dispose: this.host.event.bindHotkey(hotkeys, {
          blockId: this.blockId,
        }),
      }),
      handleEvent: (name, handler) => ({
        dispose: this.host.event.add(name, handler, {
          blockId: this.blockId,
        }),
      }),
      selection$: this._viewSelection$,
      setSelection: this._setSelection,
      dataSource: ds,
      headerWidget: this._headerWidget,
      onDrag: () => () => {},
      clipboard: this.std.clipboard,
      notification: {
        toast: message => {
          const notification = this.std.getOptional(NotificationProvider);
          if (notification) {
            notification.toast(message);
          } else {
            toast(this.host, message);
          }
        },
      },
      eventTrace: () => {},
      detailPanelConfig: {
        openDetailPanel: () => Promise.resolve(),
      },
    });
  });

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>('affine-edgeless-root');
    }
    return this.rootComponent;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
    this.handleDocLinkClick();
  }

  handleDocLinkClick() {
    this.disposables.addFromEvent(
      this,
      'affine-doc-link-clicked',
      (e: CustomEvent<{ pageId: string; blockId: string }>) => {
        const { blockId } = e.detail;
        this.std.getOptional(RefNodeSlotsProvider)?.docLinkClicked.next({
          pageId: this.store.id,
          blockId,
          host: this.host,
        });
      }
    );
  }

  override renderBlock() {
    const ds = this._dataSource.value;
    const logic = this._dataViewRootLogic.value;

    // Error state: source database was deleted or not found.
    if (!ds || !logic) {
      return html`
        <div class="linked-db-error">
          ⚠️ The source database could not be found. It may have been deleted.
        </div>
      `;
    }

    const widgets = html`${repeat(
      Object.entries(this.widgets),
      ([id]) => id,
      ([_, widget]) => widget
    )}`;

    return html`
      <div contenteditable="false">${logic.render()} ${widgets}</div>
    `;
  }

  override accessor useZeroWidth = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-linked-database': LinkedDatabaseBlockComponent;
  }
}
