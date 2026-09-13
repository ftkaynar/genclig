/**
 * FOUC önleyici. React yüklenmeden önce <head> içinde senkron çalışır ve
 * html elementine data-theme'i yazar; böylece ilk boyama doğru temayla olur.
 *
 * Neden elle yazılmış tek satırlık script: bu kodun bundle'a girip
 * hydration'dan sonra çalışması işe yaramaz, boyamadan önce koşması gerekiyor.
 *
 * localStorage anahtarı theme-provider.tsx içindeki THEME_STORAGE_KEY ile
 * aynı olmak zorunda; ikisi ayrışırsa kullanıcı tercihi sessizce yok sayılır.
 */
export const themeInitScript = `
!function(){try{
var k="genclig-theme",s=localStorage.getItem(k),p=location.pathname,
d=(p.indexOf("/panel")===0||p.indexOf("/admin")===0)?"light":"dark";
document.documentElement.dataset.theme=(s==="light"||s==="dark")?s:d
}catch(e){document.documentElement.dataset.theme="dark"}}()
`.trim();
