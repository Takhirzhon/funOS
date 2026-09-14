/* The MIME type an internal drag carries.
 *
 * Its own module so that the desktop and Explorer can both use it without
 * importing each other - Explorer is in the app registry, the desktop reads the
 * registry, and a constant shared directly between them would close that loop.
 *
 * A custom type rather than "text/plain" on purpose: it means a path dragged
 * out of funOS does nothing when dropped into a text editor in the host
 * operating system, instead of pasting "C:/Documents and Settings/..." into it.
 */
export const PATH_MIME = "application/x-funos-path";
