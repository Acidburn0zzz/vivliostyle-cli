/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type VivliostyleConfigSchema = CoreProps;
export type Entry = string;
export type Output = string;

export interface CoreProps {
  /**
   * Title
   */
  title?: string;
  /**
   * Author
   */
  author?: string;
  /**
   * Theme package path or URL of css file.
   */
  theme?: string;
  entry?: (Entry | EntryObject | ContentsEntryObject)[] | Entry | EntryObject;
  entryContext?: string;
  output?: (Output | OutputObject)[] | Output | OutputObject;
  workspaceDir?: string;
  includeAssets?: Entry[] | Entry;
  size?: string;
  pressReady?: boolean;
  language?: string;
  toc?: boolean | string;
  tocTitle?: string;
  cover?: string;
  timeout?: number;
  vfm?: {
    hardLineBreaks?: boolean;
    disableFormatHtml?: boolean;
  };
  [k: string]: unknown;
}
export interface EntryObject {
  path: string;
  title?: string;
  theme?: string;
  encodingFormat?: string;
  rel?: string | string[];
}
export interface ContentsEntryObject {
  rel: 'contents';
  title?: string;
  theme?: string;
}
export interface OutputObject {
  path: string;
  format?: string;
}
