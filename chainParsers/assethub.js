const xcmgarTool = require("../xcmgarTool");
const ChainParser = require("./common_chainparser");

/*
Fork this template to create new custom parser

Support chains
polkadot-1000|asset-hub-polkadot
kusama-1000|asset-hub-kusama
*/

module.exports = class AssetHubParser extends ChainParser {

    parserName = 'AssetHub';

    //change [garPallet:garPallet] to the location where the asset registry is located.  ex: [assets:metadata]
    garPallet = 'assets';
    garStorage = 'metadata';

    //change [xcGarPallet:xcGarStorage] to the location where the xc registry is located.  ex: [assetManager:assetIdType]
    xcGarPallet = 'unknown'
    xcGarStorage = 'unknown'

    augment = {}
    manualRegistry = {
        "polkadot-1000": [{
            asset: {
                "Token": "1984"
            },
            xcmInteriorKey: '[{"network":"polkadot"},{"parachain":1000},{"palletInstance":50},{"generalIndex":1984}]'
        }],
        'kusama-1000': [{
            asset: {
                "Token": "1984"
            },
            xcmInteriorKey: '[{"network":"kusama"},{"parachain":1000},{"palletInstance":50},{"generalIndex":1984}]'
        }]
    }

    isXcRegistryAvailable = false

    //step 1: parse gar pallet, storage for parachain's asset registry
    async fetchGar(chainkey) {
        // implement your gar parsing function here.
        await this.processAssethubGar(chainkey)
    }

    //step 2: parse xcGar pallet, storage for parachain's xc asset registry
    async fetchXcGar(chainkey) {
        //AssetHub does not expose xc registry
        if (!this.isXcRegistryAvailable) {
            // skip if xcGar parser is unavailable
            console.log(`[${chainkey}] ${this.parserName} xcGar NOT IMPLEMENTED - SKIP`)
            return
        }
    }

    //step 3: Optional augmentation by providing (a) a list xcm extrinsicIDs or (b) known xcmInteriorKeys-assets mapping
    async fetchAugments(chainkey) {
        //[Optional A] implement your augment parsing function here.
        await this.processAssetHubAugment(chainkey)
        //[Optional B ] implement your manual registry here.
        await this.processAssethubManualRegistry(chainkey)

    }

    // Implement assetHub gar parsing function here
    async processAssethubGar(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom GAR parser`)
        //step 0: use fetchQuery to retrieve gar registry at the location [assets:garStorage]
        let a = await super.fetchQuery(chainkey, this.garPallet, this.garStorage, 'GAR')
        if (a) {
            // step 1: use common Asset pallet parser func available at generic chainparser.
            let assetList = this.processGarAssetPallet(chainkey, a)
            // step 2: load up results
            for (const assetChainkey of Object.keys(assetList)) {
                let assetInfo = assetList[assetChainkey]
                this.manager.setChainAsset(chainkey, assetChainkey, assetInfo)
            }
        }
    }

    // Implement assethub xcGar parsing function here
    async processAssetHubXcGar(chainkey) {
        //TODO
    }

    // Implement assethub manual registry function here
    async processAssethubManualRegistry(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} manual`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let manualRecs = this.manualRegistry[chainkey]
        this.processManualRegistry(chainkey, manualRecs)
    }

    async processAssetHubAugment(chainkey) {
        console.log(`[${chainkey}] ${this.parserName} custom augmentation`)
        let pieces = chainkey.split('-')
        let relayChain = pieces[0]
        let paraIDSource = pieces[1]
        let recs = this.augment[chainkey]
        // step 0: fetch specified extrinsics
        let augmentedExtrinsics = await this.fetchAugmentedExtrinsics(chainkey, recs)
        for (const augmentedExtrinsic of augmentedExtrinsics) {
            console.log(`augmentedExtrinsic`, augmentedExtrinsic)
            // step 1: use common xTokens parser func available at generic chainparser.
            let augmentedMap = this.processOutgoingXTokens(chainkey, augmentedExtrinsic)
            // step 2: load up results
            for (const xcmInteriorKey of Object.keys(augmentedMap)) {
                let augmentedInfo = augmentedMap[xcmInteriorKey]
                let assetID = augmentedInfo.assetID
                let assetChainkey = augmentedInfo.assetChainkey
                this.manager.addXcmAssetLocalCurrencyID(xcmInteriorKey, paraIDSource, assetID, chainkey)
                let cachedAssetInfo = this.manager.getChainAsset(assetChainkey)
                if (cachedAssetInfo) {
                    cachedAssetInfo.xcmInteriorKey = xcmInteriorKey
                    this.manager.setChainAsset(chainkey, assetChainkey, cachedAssetInfo)
                }
            }
        }
    }
}