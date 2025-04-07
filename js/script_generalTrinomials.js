document.addEventListener('DOMContentLoaded', () => {
  const factorBtn = document.getElementById('factorBtn');
  const stepsDiv = document.getElementById('steps');

  factorBtn.addEventListener('click', () => {
    const userPolynomial = document.getElementById('userPolynomial').value;
    const resultHTML = factorGeneralTrinomial(userPolynomial);
    stepsDiv.innerHTML = resultHTML;
    
    // Recargar MathJax para renderizar las fórmulas en LaTeX
    if (window.MathJax) {
      window.MathJax.typeset();
    }
  });
});

/**
 * Factoriza un trinomio que puede tener dos formas:
 * 1. Trinomio clásico: v^2 + b*v + c (por ejemplo, b^2-5b+6).
 * 2. Trinomio cuadrático por sustitución: v^(2k) + b*v^k + c (por ejemplo, v^16+58v^8+697).
 *
 * Se combinan los términos constantes (y de variable si fuese el caso).
 */
function factorGeneralTrinomial(polyStr) {
  // Eliminar espacios
  let poly = polyStr.replace(/\s+/g, '');

  // Separar términos por + y - (manteniendo el signo)
  let rawTerms = poly.replace(/-/g, '+-').split('+').filter(s => s !== '');
  // Parsear cada término
  let parsedTerms = rawTerms.map(term => parseTerm(term));

  // Si algún término no se pudo parsear, error.
  if (parsedTerms.includes(null)) {
    return `<p>Error al analizar la expresión. Revisa el formato.</p>`;
  }
  
  // Combinar constantes (suma de todos los términos constantes)
  let constTerms = parsedTerms.filter(t => t.type === 'const');
  let constSum = constTerms.reduce((acc, t) => acc + t.coef, 0);
  // Eliminar los términos constantes y agregar uno combinado (si existe alguno)
  parsedTerms = parsedTerms.filter(t => t.type !== 'const');
  if (constTerms.length > 0) {
    parsedTerms.push({ type: 'const', exp: 0, coef: constSum });
  }
  
  // Combinar términos variables que sean "iguales" (misma variable y mismo exponente)
  let varTerms = {};
  parsedTerms.filter(t => t.type === 'var').forEach(t => {
    let key = t.variable + '^' + t.exp;
    if (varTerms[key]) {
      varTerms[key].coef += t.coef;
    } else {
      varTerms[key] = { ...t };
    }
  });
  // Convertir el objeto a arreglo
  let combinedVarTerms = Object.values(varTerms);
  // Reemplazar en parsedTerms: quitar los antiguos términos variables y agregar los combinados
  parsedTerms = parsedTerms.filter(t => t.type === 'const').concat(combinedVarTerms);

  // Ahora se espera que el trinomio tenga dos tipos de términos:
  // - Términos variables (uno o dos) y
  // - Un único término constante.
  let finalConst = parsedTerms.find(t => t.type === 'const');
  let finalVar = parsedTerms.filter(t => t.type === 'var');

  // Si no hay constante o no hay variable o hay más de dos términos variables, no es de la forma esperada.
  if (!finalConst || finalVar.length < 1 || finalVar.length > 2) {
    return `<p>La expresión no corresponde a ninguno de los formatos esperados (debe tener una parte constante y uno o dos términos variables).</p>`;
  }
  
  // Reordenar términos variables de mayor a menor exponente
  finalVar.sort((a, b) => b.exp - a.exp);
  
  // Caso 1: Trinomio clásico: se espera dos términos variables, uno con exponente 2 y otro con exponente 1.
  if (finalVar.length === 2 && finalVar[0].exp === 2 && finalVar[1].exp === 1) {
    let variable = finalVar[0].variable; // se asume que ambos usan la misma letra
    let b = finalVar[1].coef;
    let c = finalConst.coef;
    return factorClassicTrinomial(variable, b, c);
  }
  
  // Caso 2: Trinomio por sustitución: se espera dos términos variables con mayor exponente = 2k y menor = k.
  if (finalVar.length === 2 && finalVar[0].exp % 2 === 0 && finalVar[1].exp === finalVar[0].exp / 2) {
    let variable = finalVar[0].variable;
    let exp2 = finalVar[0].exp; // 2k
    let k = finalVar[1].exp;    // k
    let b = finalVar[1].coef;
    let c = finalConst.coef;
    return factorPolyBySubstitution(variable, exp2, k, b, c);
  }
  
  // Caso especial: Si solo hay 1 término variable con exponente 2 y uno constante, se asume b=0.
  if (finalVar.length === 1 && finalVar[0].exp === 2) {
    let variable = finalVar[0].variable;
    let b = 0;
    let c = finalConst.coef;
    return factorClassicTrinomial(variable, b, c);
  }
  
  return `<p>La expresión no corresponde a ninguno de los formatos esperados.</p>`;
}

/**
 * Parsea un término.
 * Se aceptan:
 *  - Constantes: formato numérico, o potenciado sin variable, por ejemplo "102" o "-11^6".
 *  - Términos variables: formato ([+-]?\d*)?[a-zA-Z](\^\d+)? 
 *    Ejemplos: "b^2", "-5b", "+4b^2", "b" (se asume exponente 1)
 */
function parseTerm(term) {
  // Si el término contiene '^' pero NO contiene ninguna letra, lo evaluamos como potencia de un número.
  if (/^[+-]?\d+\^\d+$/.test(term)) {
    let sign = 1;
    if (term[0] === '-') {
      sign = -1;
      term = term.substring(1);
    }
    let parts = term.split('^');
    let base = parseInt(parts[0], 10);
    let exp = parseInt(parts[1], 10);
    return { type: 'const', exp: 0, coef: sign * Math.pow(base, exp) };
  }
  
  // Si es solo un número (constante)
  if (/^[+-]?\d+$/.test(term)) {
    return { type: 'const', exp: 0, coef: parseInt(term, 10) };
  }
  
  // Caso para términos variables: se acepta exponente opcional.
  // La expresión regular:
  // ^([+-]?\d*)?  -> coeficiente opcional
  // ([a-zA-Z])    -> la variable (una letra)
  // (\^\d+)?      -> exponente opcional (por ejemplo, "^2")
  let varMatch = term.match(/^([+-]?\d*)?([a-zA-Z])(\^\d+)?$/);
  if (varMatch) {
    let coefStr = varMatch[1];
    let variable = varMatch[2];
    let expStr = varMatch[3]; // Puede ser undefined

    // Determinar coeficiente
    let coef;
    if (!coefStr || coefStr === '+') {
      coef = 1;
    } else if (coefStr === '-') {
      coef = -1;
    } else {
      coef = parseInt(coefStr, 10);
    }

    // Determinar exponente (por defecto 1 si no se indica)
    let exp = 1;
    if (expStr) {
      exp = parseInt(expStr.slice(1), 10); // quitar el '^'
    }
    return { type: 'var', variable, exp, coef };
  }
  
  // Si no se reconoce, retorna null.
  return null;
}

/**
 * Factoriza un trinomio clásico de la forma v^2 + b*v + c.
 */
function factorClassicTrinomial(variable, b, c) {
  let stepHTML = `
    <p><strong>Paso 1:</strong> Identificar la variable y coeficientes</p>
    <p>
      La expresión es: \\( ${variable}^2 ${formatSignNumber(b)}${variable} ${formatSignNumber(c)} \\).<br>
      Es decir, \\( a = 1, \\; b = ${b}, \\; c = ${c} \\).
    </p>
    <p><strong>Paso 2:</strong> Encontrar dos números m y n tales que:</p>
    <p>
      \\( m + n = ${b} \\) y \\( m \\cdot n = ${c} \\).
    </p>
  `;
  
  let factors = findFactors(b, c);
  if (!factors) {
    stepHTML += `<p>No se encontraron números enteros m y n que satisfagan la condición. El trinomio no es factorizable en enteros.</p>`;
    return stepHTML;
  }
  let m = factors.m;
  let n = factors.n;
  
  stepHTML += `
    <p>
      Se encontró que \\( m = ${m} \\) y \\( n = ${n} \\) ya que \\( ${m} + ${n} = ${b} \\) y \\( ${m} \\times ${n} = ${c} \\).
    </p>
    <p><strong>Paso 3:</strong> Factorización final</p>
    <p>
      \\[
        ${variable}^2 ${formatSignNumber(b)}${variable} ${formatSignNumber(c)}
        = (${variable} ${formatSignNumber(m)})(${variable} ${formatSignNumber(n)}).
      \\]
    </p>
  `;
  return stepHTML;
}

/**
 * Factoriza un trinomio de la forma v^(2k) + b*v^k + c mediante sustitución, usando w = v^k.
 */
function factorPolyBySubstitution(variable, exp2, k, b, c) {
  let stepHTML = `
    <p><strong>Paso 1:</strong> Reordenar la expresión</p>
    <p>
      La expresión reordenada es: \\[
        ${variable}^{${exp2}} ${formatSignNumber(b)}${variable}^{${k}} ${formatSignNumber(c)}
      \\]
      Es decir, de la forma \\( ${variable}^{2k} + ${b}${variable}^{${k}} + ${c} \\) con \\( k = ${k} \\).
    </p>
    <p><strong>Paso 2:</strong> Realizar la sustitución</p>
    <p>
      Sea \\( w = ${variable}^{${k}} \\). Entonces, \\( ${variable}^{${exp2}} = w^2 \\).<br>
      La expresión se transforma en: \\[
         w^2 ${formatSignNumber(b)}w ${formatSignNumber(c)}
      \\]
    </p>
    <p><strong>Paso 3:</strong> Factorizar el trinomio en \\(w\\)</p>
  `;
  
  let factors = findFactors(b, c);
  if (!factors) {
    stepHTML += `<p>No se encontraron números enteros m y n que factorizan el trinomio en \\(w\\).</p>`;
    return stepHTML;
  }
  let m = factors.m;
  let n = factors.n;
  
  stepHTML += `
    <p>
      Se busca \\( m \\) y \\( n \\) tales que \\( m+n = ${b} \\) y \\( m \\cdot n = ${c} \\).<br>
      Se encontró que \\( m = ${m} \\) y \\( n = ${n} \\).
    </p>
    <p><strong>Paso 4:</strong> Sustitución inversa y factorización final</p>
    <p>
      En \\(w\\), tenemos: \\[
         w^2 ${formatSignNumber(b)}w ${formatSignNumber(c)}
         = (w ${formatSignNumber(m)})(w ${formatSignNumber(n)}).
      \\]<br>
      Reemplazando \\(w = ${variable}^{${k}}\\), la factorización es:<br>
      \\[
         ${variable}^{${exp2}} ${formatSignNumber(b)}${variable}^{${k}} ${formatSignNumber(c)}
         = \\Bigl(${variable}^{${k}} ${formatSignNumber(m)}\\Bigr)\\Bigl(${variable}^{${k}} ${formatSignNumber(n)}\\Bigr).
      \\]
    </p>
  `;
  
  return stepHTML;
}

/**
 * Retorna un string con signo para un número, e.g. 5 → "+5", -3 → "-3".
 */
function formatSignNumber(num) {
  return (num >= 0) ? `+${num}` : `${num}`;
}

/**
 * Busca dos números enteros m y n tales que:
 * m + n = b  y  m * n = c.
 */
function findFactors(b, c) {
  let limit = Math.abs(c);
  for (let m = -limit; m <= limit; m++) {
    let n = b - m;
    if (m * n === c) {
      return { m, n };
    }
  }
  return null;
}
