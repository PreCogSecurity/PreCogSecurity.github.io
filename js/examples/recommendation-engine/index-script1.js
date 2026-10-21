const color_normalization_factor = 100;
		const neckline_normalization_factor = 10;
		const price_normalization_factor = 100;

		let trainingData = [
			{ input: {color: color_black, hasPrinting: false, neckline: neckline_round, price: 0.1999 }, output: { wanted: 0 } }
		];
		let ratingItem;

		function nextTry(rating){
			document.getElementById('result').innerHTML = '';

            if(undefined !== ratingItem){
                trainingData.push({ input: ratingItem.trainingInformation, output: { wanted: rating / 4 } });
            }

			const network = new brain.NeuralNetwork({
				activation: 'sigmoid',
				hiddenLayers: [4]
			});
			network.train(trainingData);

			let suggestionItemsText = '';
			let suggestionItems = [];
			for(i=0;i<itemsInStock.length;i++){
				let item = getNormalizedItemFromStock(i);
				item.wanted = network.run(item.trainingInformation).wanted;
				suggestionItems.push(item);
			}

			suggestionItems.sort(function(a,b){
				return b.wanted - a.wanted;
			});

			for(i=0;i<suggestionItems.length;i++){
				suggestionItem = suggestionItems[i];
				suggestionItemsText +=
					'<div class="suggestionItem">' +
						getFormattedItem(suggestionItem) + ' <br/> ' +
						'wanted: ' + Math.round(suggestionItem.wanted * 100) + '%'
					+ '</div>';
			}

			ratingItem = getNormalizedItemFromStock(Math.floor((Math.random() * itemsInStock.length - 1) + 1));
			document.getElementById('result').innerHTML +=
				'<div class="ratingItem">' +
					'Rate this:<br/>' +
					getFormattedItem(ratingItem) + '<br/>' +
				'</div>' +
				'Suggested items:<br/>' +
				'<div class="suggestedItems">' +
					suggestionItemsText +
				'</div>';
		}

		function getNormalizedItemFromStock(index){
			const item = itemsInStock[index];
			trainingInformation = item.trainingInformation;
			return {
				trainingInformation : {
					color: trainingInformation.color / color_normalization_factor,
					hasPrinting: trainingInformation.hasPrinting,
					neckline: trainingInformation.neckline / neckline_normalization_factor,
					price: trainingInformation.price / price_normalization_factor
				},
				displayingInformation : item.displayingInformation
			};
		}

		function getFormattedItem(item){
			const trainingInformation = item.trainingInformation;
			const formattedItem =
				'<img class="articleImage" src="images/articles/' + item.displayingInformation.imageFile + '"/><br/>' +
				'color: ' + getColorName(trainingInformation.color) + '<br/>' +
				'has printing?: ' + (1 === trainingInformation.hasPrinting ? 'yes' : 'no') + '<br/>' +
				'neckline: ' + getNecklineName(trainingInformation.neckline) + '<br/>' +
				'price: ' + ((Math.round((trainingInformation.price * price_normalization_factor) * 100)) / 100) + ' &euro;';
			return formattedItem;
		}

		function getColorName(color){
			var id = color * color_normalization_factor;
			var name =
				color_black === id ? 'black' :
				color_blue === id ? 'blue' :
				color_darkblue === id ? 'dark blue' :
				color_gray === id ? 'gray' :
				color_green === id ? 'green' :
				color_lightblue === id ? 'light blue' :
				color_lightgreen === id ? 'light green' :
				color_skin === id ? 'skin' :
				color_turqoise === id ? 'turqoise' :
				color_white === id ? 'white' :
				'';
			return name;
		}

		function getNecklineName(color){
			var id = color * neckline_normalization_factor;
			var name =
				neckline_round === id ? 'round' :
				neckline_v === id ? 'v' :
				'';
			return name;
		}
