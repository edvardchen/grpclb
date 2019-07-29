export default function removeFromArray<T>(
  list: T[],
  candition: (item: T) => boolean
): void {
  const index = list.findIndex(candition);
  if (index !== -1) {
    list.splice(index, 1);
  }
}
