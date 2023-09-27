// code to change background and text color
let light = document.getElementById('light');
let dark = document.getElementById('dark');

const body = document.querySelector("body"),
  toggle = document.querySelector(".toggle");
  
let getMode = localStorage.getItem("mode");
if (getMode && getMode === "dark") {
  light.classList.add("active");
  dark.classList.add("active");
  body.classList.add("dark");
  toggle.classList.add("active");
}
toggle.addEventListener("click", () => {
  light.classList.toggle("active");
  dark.classList.toggle("active");
  body.classList.toggle("dark");
  if (!body.classList.contains("dark")) {
    return localStorage.setItem("mode", "light");
  }
  localStorage.setItem("mode", "dark");
});
toggle.addEventListener("click", () => toggle.classList.toggle("active"));



// code to clear textarea
function doThis() {
  var t = document.getElementById('input');
  t.value = "";
}

// code to paste text into textarea
const pasteButton = document.querySelector('#btn2');

pasteButton.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText()
    document.querySelector('textarea').value += text;
    console.log('Text pasted.');
  } catch (error) {
    console.log('Failed to read clipboard');
  }
});

// code to get value from textarea
    function getValue() {
          var val = document.getElementById("input").value;
        document.getElementById("output").innerHTML = val;
        
        let hide = document.getElementById("hide");
        
        
        if(hide.style.display = "block") {
            hide.style.display = "none";
        }
        
        
    }
    
    // Google translate API
        function googleTranslateElementInit() {  
            new google.translate.TranslateElement(  
                {pageLanguage: 'ii-CN'},  
                'google_translate_element'  
            );  
        }  
    
    // code to copy text from html element
      function copyText() {
        
        /* Select text by id*/
        var Text = document.getElementById("output").innerText;
        
  
        /* Copy selected text into clipboard */
        navigator.clipboard.writeText(Text);
      }
