import CoreImage
import ExpoModulesCore
import Vision

/// Détoure le sujet principal d'une photo (comme l'appui long dans Photos) et renvoie un PNG transparent.
public class SubjectLiftModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectLift")

    AsyncFunction("liftSubject") { (uri: URL) -> String in
      guard #available(iOS 17.0, *) else { throw SubjectLiftError("Détourage disponible à partir d’iOS 17.") }
      guard let image = CIImage(contentsOf: uri) else { throw SubjectLiftError("Photo illisible.") }

      let handler = VNImageRequestHandler(ciImage: image)
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])
      guard let result = request.results?.first, !result.allInstances.isEmpty else {
        throw SubjectLiftError("Aucun sujet trouvé sur la photo.")
      }

      let masked = try result.generateMaskedImage(
        ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: true)
      let output = FileManager.default.temporaryDirectory.appendingPathComponent("detoure-\(UUID().uuidString).png")
      try CIContext().writePNGRepresentation(
        of: CIImage(cvPixelBuffer: masked), to: output, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
      return output.absoluteString
    }
  }
}

struct SubjectLiftError: Error, CustomStringConvertible {
  let description: String
  init(_ description: String) { self.description = description }
}
