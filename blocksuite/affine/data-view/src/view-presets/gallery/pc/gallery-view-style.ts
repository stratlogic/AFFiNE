import { css } from 'lit';

export const galleryViewStyle = css`
  display: flex;
  flex-direction: column;
  padding: 12px 0;
`;

export const galleryGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 8px 0;
`;

export const galleryCardStyle = css`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--affine-border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--affine-background-primary-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
`;

export const galleryCardCoverStyle = css`
  height: 140px;
  background-color: var(--affine-background-secondary-color);
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--affine-border-color);
`;

export const galleryCardContentStyle = css`
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
`;

export const galleryCardPropertyStyle = css`
  display: flex;
  align-items: center;
  font-size: 14px;
`;
