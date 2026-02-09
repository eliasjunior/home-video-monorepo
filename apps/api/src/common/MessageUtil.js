export function logE(message, err) {
  console.error(` ====== ERR! ======= \n${message}`);
  if (err) {
    console.error(err);
  }
}

export function logD(message, obj) {
  const { showdebug } = process.env;
  if (showdebug) {
    if (obj) {
      console.log(message, obj);
    } else {
      console.log(message);
    }
  }
}
