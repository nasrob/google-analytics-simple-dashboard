document.addEventListener('DOMContentLoaded', (event) => {
    const buttons = document.querySelectorAll("#select .button")
    for (const button of buttons) {
        button.addEventListener('click', function (event) {
            for (const button of buttons) {
                button.classList.remove('active')
            }

            this.classList.add('active')

            const organicStats = document.querySelectorAll('#stats .organic')
            const totalStats = document.querySelectorAll('#stats .total')

            if (this.classList.contains('organic')) {
                for (const item of organicStats) {
                    item.classList.remove('hidden')
                }
                for (const item of totalStats) {
                    item.classList.add('hidden')
                }
            } else {
                for (const item of organicStats) {
                    item.classList.add('hidden')
                }
                for (const item of totalStats) {
                    item.classList.remove('hidden')
                }
            }

            event.preventDefault()
        })
    }
})