// Allow the HTML `inert` attribute in JSX without casting.
declare namespace JSX {
  interface IntrinsicAttributes {
    inert?: boolean | '' | 'true' | 'false';
  }
  interface HTMLAttributes {
    inert?: boolean | '' | 'true' | 'false';
  }
}
