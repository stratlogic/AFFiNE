import { css } from 'lit';

export const listViewStyle = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
`;

export const listRowStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  min-height: 32px;
  &:hover {
    background-color: var(--affine-hover-color);
  }
  border-bottom: 1px solid var(--affine-border-color);
`;

export const listCellContainerStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;
